import json
from PIL import Image
import boto3
import os
from io import BytesIO
import urllib.parse
# import uuid
from PIL import UnidentifiedImageError

s3_client = boto3.client('s3')

def lambda_handler(event, context):
    # Fetch the target bucket name from environment variable
    target_bucket_name = os.environ.get('TARGET_BUCKET')
    print(f"Target bucket: {target_bucket_name}")

    if not target_bucket_name:
        raise ValueError("Target bucket name is not set in environment variables.")
    
    # Log the full event for debugging purposes
    # print("Event received:", json.dumps(event, indent=4))

    try:
        # Get the bucket and object key from the event
        bucket_name = event['Records'][0]['s3']['bucket']['name']
        object_key = event['Records'][0]['s3']['object']['key']

        # Decode the object key to handle URL encoding issues
        object_key = urllib.parse.unquote_plus(object_key)
        
        # Log the bucket name and object key for verification
        print(f"Source Bucket: {bucket_name}")
        print(f"Object Key: {object_key}")

        # Log a message indicating the start of the compression process
        print(f"Starting compression for object: {object_key}")

        if not object_key.startswith("resized_"):
            # Fetch the image from the S3 bucket
            print(f"Fetching object: {object_key} from bucket: {bucket_name}")
            s3_response = s3_client.get_object(Bucket=bucket_name, Key=object_key)
            image_data = s3_response['Body'].read()

            # Log that image data has been successfully fetched
            print(f"Image data fetched for object: {object_key}")

            # Open and process the image
            image = Image.open(BytesIO(image_data))
            
            # Get original format
            original_format = image.format
            print(f"Original image format: {original_format}")
            
            # Convert to RGB if image is not in RGB mode
            if image.mode not in ('RGB', 'L'):
                image = image.convert('RGB')

            # Calculate new dimensions while maintaining aspect ratio
            max_size = 1600
            ratio = min(max_size / image.width, max_size / image.height)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            
            # Resize image
            resized_image = image.resize(new_size, Image.Resampling.LANCZOS)

            # Determine output format and compression settings
            output_format = original_format
            output_buffer = BytesIO()
            
            if original_format == 'JPEG' or original_format == 'JPG':
                resized_image.save(output_buffer, 
                                 format='JPEG', 
                                 quality=85,
                                 optimize=True)
            elif original_format == 'PNG':
                resized_image.save(output_buffer, 
                                 format='PNG',
                                 optimize=True,
                                 compress_level=9)
            elif original_format == 'WEBP':
                resized_image.save(output_buffer, 
                                 format='WEBP',
                                 quality=85,
                                 method=6)
            elif original_format == 'GIF':
                resized_image.save(output_buffer, 
                                 format='GIF',
                                 optimize=True)
            else:
                # Default to JPEG for unsupported formats
                output_format = 'JPEG'
                resized_image.save(output_buffer, 
                                 format='JPEG',
                                 quality=85,
                                 optimize=True)
            
            output_buffer.seek(0)

            # Preserve original extension in the new filename
            original_extension = os.path.splitext(object_key)[1].lower()
            if output_format == 'JPEG' and original_extension not in ['.jpg', '.jpeg']:
                original_extension = '.jpg'
            
            new_object_key = f"resized_{os.path.splitext(object_key)[0]}{original_extension}"

            # Upload the resized image
            print(f"Uploading resized image to {target_bucket_name}/{new_object_key}")
            response = s3_client.put_object(Bucket=target_bucket_name, Key=new_object_key, Body=output_buffer)

            # Log the response from the put_object call
            print(f"PutObject response: {response}")

        else:
            print(f"Object {object_key} is already resized. Skipping processing.")

    except UnidentifiedImageError as e:
        print(f"Error: Unable to identify image format for {object_key}")
        raise e
    except MemoryError as e:
        print(f"Memory error occurred while processing image {object_key}")
        raise e
    except Exception as e:
        print(f"Error processing object {object_key} from bucket {bucket_name}: {str(e)}")
        raise e

    return {
        'statusCode': 200,
        'body': json.dumps('Compression Complete!')
    }