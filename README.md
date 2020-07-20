# Helper to redirect output data to IBM Cloud Object Storage

## What is this?

This package helps to execute commands and send their output to a bucket using S3 protocol.
This approach avoids a lot of needed disk and memory resources when large files need to be uploaded to COS, as streams immediately send data as soon data is available.

## Usage Example

```javascript
// example to run a pg_dump and redirect the output to COS
const Redirect2COS = require('@marcosbv/redirect-to-cos')

// instantiate my redirect object
const obj = new Redirect2COS({
    endpoint: 's3.sao01.cloud-object-storage.appdomain.cloud',
    apiKeyId: '<YouAPIKey>',
    serviceInstanceId: 'crn:v1:bluemix:public:cloud-object-storage:global:a/3e819260d4f340c0999240e909d61a08:539c314a-de88-4336-8b83-3d1efd0cec65'
})

// pg_dump args (password will be provided by PGPASSWORD environment variable)
const args = [
    '-h',
    '<MyCloudDBHost>',
    '-p',
    '<MyDBPort>',
    '-U',
    '<MyUser>',
    '-d',
    '<MyDatabase>',
    '-F',
    'custom'
]

// Bucket name and output object file name to be created
const bucket_options = {Bucket: 'test-backups', Key: 'pg_dump.bkp.gz'};

// transfer options (parts of 20MB, 20 concurrent connections)
const transfer_options = {partSize: 20 * 1024 * 1024, queueSize: 20};

// performs commands, send its output to COS using compression
obj.execCommandAndSendToCOS('pg_dump', args, bucket_options, transfer_options, true)

// emitted when command finishes
obj.on('command_exit', (code) => {
    console.log(`Command return code: ${code}`)
})

// emitted when upload completes
obj.on('upload_finish', (data) => {
    console.log('Finished test!')
})
```

## Class COSRedirector

### Constructor

Parameters:

Config object with the following Config information:
- endpoint - Object Storage Endpoint to connect to

- apiKeyId - IBM Cloud API Key to upload files. This key must have a Writer permission in the bucket.

- serviceInstanceId - IBM Cloud COS CRN


### execCommandAndSendToCOS(command, args, bucket\_options, transfer\_options, compressed=false)
Executes a command and send its output to Cloud Object Storage.
This command tries to use streams to avoid high memory and disk usage.
However, that depends on the way the called program proceeds to send its output.
This method spawns a new child process and call uploadStreamToCOS using child's standard output as a parameter.

Two events are emitted:
      
* command_exit, when spawned process finishes -> status code is passed to callback function
* command_init_error, when spawned process fails to start -> error object is passed to callback function.

Arguments:


command - executable program name to run (it is required to be in PATH)

args    - array of arguments to pass to command

bucket\_options  - an object containing bucket options. Values include:
*   Bucket: bucket name to store

*   Key:    object name to store in COS.
Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#upload-property
 

transfer\_options - an object containing transfer options. Values include:
*   partSize: the size in bytes for each individual part to be uploaded.

*   queueSize: the size of the concurrent queue manager to upload parts in parallel. 

Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3/ManagedUpload.html

compressed - the content should be compressed using gzip before sending.


### uploadStreamToCOS(stream, bucket\_options, transfer\_options, compressed=false)

Uploads content to a COS bucket.
This method emits two events:
 
* upload_finish, when upload process successfully finish. Data object is returned with the following fields:
    - Location (String) the URL of the uploaded object 
    - ETag (String) the ETag of the uploaded object 
    - Bucket (String) the bucket to which the object was uploaded 
    - Key (String) the key to which the object was uploaded

* upload_error, when an error happens while uploading. An Error object is returned containing the cause.

Arguments:

stream          -  Readable Stream to read data from.

command - executable program name to run (it is required to be in PATH)

args    - array of arguments to pass to command

bucket\_options  - an object containing bucket options. Values include:
*   Bucket: bucket name to store

*   Key:    object name to store in COS.
Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#upload-property
 

transfer\_options - an object containing transfer options. Values include:
*   partSize: the size in bytes for each individual part to be uploaded.

*   queueSize: the size of the concurrent queue manager to upload parts in parallel. 

Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3/ManagedUpload.html

compressed - the content should be compressed using gzip before sending.


