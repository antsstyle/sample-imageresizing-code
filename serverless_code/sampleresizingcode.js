"use strict";
const stream = require("stream"),
        sharp = require("sharp"),
        S3 = require("aws-sdk/clients/s3");

/*
 * Notes: do not enable a VPC for this function. Set the Node.js version to 16.x, and architecture to x86_64. It's possible to run this on ARM, but compiling the Sharp binaries is a pain and it runs around 60-80% slower (meaning it'll cost more).
 * 
 * Compiling the Sharp binaries for x86_64 is fairly easy - you can create a Lightsail Node.js instance ($3.50 server will do), and compile Sharp via npm install on that.
 */

// process.env is determined by your Lambda function's environment variables, i.e. create an environment variable AWS_KEY with a value corresponding to whatever IAM user's access key you are using for this, and so forth. Regions are in the usual 'eu-west-1' or 'us-east-2' form.
const s3 = new S3({
    apiVersion: process.env.S3_API_VERSION,
    region: process.env.S3_AWS_REGION,
    credentials: {
        accessKeyId: process.env.AWS_KEY,
        secretAccessKey: process.env.AWS_SECRET,
    },
});

exports.handler = async (event) => {
    // Example JSON payload:
    /*
     * {
     *    "parameters": {
     *        "imageKey": "something.jpg",
     *        "imageWidth": 500,
     *        "imageHeight": 500,
     *        "imageQuality": 90
     *    }
     * }
     */

    const imageKey = event.parameters.imageKey;
    const width = event.parameters.imageWidth;
    const height = event.parameters.imageHeight;
    const quality = event.parameters.imageQuality;

    var inputBucket = process.env.S3_INPUT_BUCKET;
    var outputBucket = process.env.S3_OUTPUT_BUCKET;

    // Load the original image from S3
    try {
        const params = {
            Bucket: inputBucket,
            Key: imageKey,
        };
        var originalImage = await s3.getObject(params).promise();
    } catch (error) {
        console.log("Failed to retrieve original image from S3: " + error.message);
        return;
    }

    const imageBody = originalImage.Body;

    let dimensions = {
        width: parseInt(width, 10),
        height: parseInt(height, 10),
    };


    let bufferData = await sharp(imageBody)
            .resize(
                    Object.assign(dimensions, {
                        // Ensures the image is never enlarged if for whatever reason your width and height parameters are larger than the image's actual size.
                        withoutEnlargement: true,
                        // 'Inside' preserves aspect ratio, will resize the image to fit within the width and height specified (maximum).
                        fit: 'inside',
                        kernel: 'lanczos3',
                    })
                    )
            .toFormat('jpeg')
            .jpeg({
                quality: quality,
                // 4:4:4 means no colour loss, effectively disabling chroma subsampling.
                chromaSubsampling: '4:4:4',
                // Comment line below if you do not want MozJPEG encoding; MozJPEG runs slightly slower but results in lower filesize for same quality setting.
                mozjpeg: true,
            })
            .toBuffer();
    // Upload the new image to the destination bucket
    try {
        await s3.putObject({
            Body: bufferData,
            Bucket: outputBucket,
            ContentType: "image/jpg",
            Key: imageKey,
        }).promise();
    } catch (error) {
        console.log("Put object failed: " + error.stack);
    }
    return "success";
};