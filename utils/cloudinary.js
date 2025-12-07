const cloudinary = require('cloudinary').v2;
const fs = require('fs');
// const path = require('path'); // Add this if you need to construct the path
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
        
        // SUCCESS: Cleanup local file and return response
        fs.unlinkSync(filepath);
        return response; 
    } catch (error) {
        // ERROR: Log the full error object and try to clean up
        console.error(`File uploading error:`, error); 
        
        // Ensure file exists before trying to unlink, as fs.unlinkSync throws an error if file doesn't exist
        if (fs.existsSync(filepath)) {
             fs.unlinkSync(filepath);
        }
       
        return null; 
    }
}

module.exports = fileUploaderOnCloudinary;