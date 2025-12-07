const User = require("../models/user.model");


const getUsers = async (req, res)=>{
    try {
        const users = await User.find();

        if(!users) console.log('Users not found');
        return res.status(200).json(users);
    } catch (error) {
        console.log(error);
    }
}

module.exports = {
    getUsers
}