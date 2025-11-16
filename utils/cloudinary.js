const cloudinary = require('cloudinary').v2;
const fs = require('fs');
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const fileUploaderOnCloudinary = async(filepath) =>{
    try {
        if(!filepath) return null;

        const response = await cloudinary.uploader.upload(filepath, {
            resource_type: 'image'
        });
        console.log('response:',response);
        fs.unlinkSync(filepath);
        return response;
    } catch (error) {
        fs.unlinkSync(filepath)
        console.error(`File uploading error: ${error}`);
        return null;
    }
}

module.exports = fileUploaderOnCloudinary;