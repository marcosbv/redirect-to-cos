/**
 * Module to send Node Streams to IBM Cloud Object Storage.
 * 
 * This package helps to execute commands and send their output to a bucket using S3 protocol.
 * This approach avoids a lot of needed disk and memory resources when large files need to be uploaded to COS,
 * as streams immediately send data as soon data is available.
 */

const COS = require('ibm-cos-sdk')
const {spawn} = require('child_process')
const {createGzip} = require('zlib')
const extend = require('extend')
const EventEmitter = require('events')

class COSRedirector extends EventEmitter {

    /**
     * Constructor
     * @param {*} config object with the following Config information:
     * endpoint - Object Storage Endpoint to connect to
     * apiKeyId - IBM Cloud API Key to upload files. This key must have a Writer permission in the bucket.
     * serviceInstanceId - IBM Cloud COS CRN
     */
    constructor(config) {
        super()
        this.s3Conn = new COS.S3(config)
    }

    /**
     * Executes a command and send its output to Cloud Object Storage.
     * This command tries to use streams to avoid high memory and disk usage.
     * However, that depends on the way the called program proceeds to send its output.
     * This method spawns a new child process and call uploadStreamToCOS using child's standard output as a parameter.
     * Two events are emitted:
     * 
     * command_exit, when spawned process finishes -> status code is passed to callback function
     * command_init_error, when spawned process fails to start -> error object is passed to callback function.
     * 
     * @param {*} command - executable program name to run (it is required to be in PATH)
     * @param {*} args    - array of arguments to pass to command
     * @param {*} bucket_options  - an object containing bucket options. Values include:
     *   Bucket: bucket name to store
     *   Key:    object name to store in COS.
     * Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#upload-property
     * 
     * @param {*} transfer_options - an object containing transfer options. Values include:
     *   partSize: the size in bytes for each individual part to be uploaded.
     *   queueSize: the size of the concurrent queue manager to upload parts in parallel. 
     * Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3/ManagedUpload.html
     * 
     * @param {*} compressed - the content should be compressed using gzip before sending (default false). 
     */
    async execCommandAndSendToCOS(command, args, bucket_options, transfer_options, compressed=false) {
         const self = this

         const child_process = spawn(command, args)
         child_process.on('exit', (code) => {
            self.emit('command_exit', code)
         })

         child_process.on('error', (err) => {
            self.emit('command_init_error', err)
         })

         this.uploadStreamToCOS(child_process.stdout, bucket_options, transfer_options, compressed)
    }

    /**
     * Uploads content to a COS bucket.
     * This method emits two events:
     * 
     * upload_finish, when upload process successfully finish. Data object is returned with the following fields:
     * - Location (String) the URL of the uploaded object 
     * - ETag (String) the ETag of the uploaded object 
     * - Bucket (String) the bucket to which the object was uploaded 
     * - Key (String) the key to which the object was uploaded
     * 
     * upload_error, when an error happens while uploading. An Error object is returned containing the cause.
     * 
     * @param {*} stream          -  Readable Stream to read data from.
     * @param {*} bucket_options  - an object containing bucket options. Values include:
     *   Bucket: bucket name to store
     *   Key:    object name to store in COS.
     * Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3.html#upload-property
     * 
     * @param {*} transfer_options - an object containing transfer options. Values include:
     *   partSize: the size in bytes for each individual part to be uploaded.
     *   queueSize: the size of the concurrent queue manager to upload parts in parallel. 
     * Other available parameters in https://ibm.github.io/ibm-cos-sdk-js/AWS/S3/ManagedUpload.html
     * 
     * @param {*} compressed - the content should be compressed using gzip before sending (default false). 
     */
    uploadStreamToCOS(stream, bucket_options, transfer_options, compressed=false) {
        const gzip = compressed ? createGzip() : null
        
        const readStream = compressed ? stream.pipe(gzip) : stream
        const params = extend(false, bucket_options, {Body: readStream})
        const options = extend(false, transfer_options, {partSize: 10 * 1024 * 1024, queueSize: 10});
        const self = this;
        this.s3Conn.upload(params, options, function(err, data) {
            if(err!=null) {
                self.emit('upload_error', err)
            } else {
                self.emit('upload_finish', data)
            }
        });
    }
    
}


module.exports = COSRedirector