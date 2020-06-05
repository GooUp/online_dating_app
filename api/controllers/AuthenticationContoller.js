const User = require('../models/User');
const moment = require('moment');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendGridTransport = require('nodemailer-sendgrid-transport');
const config = require('../config/config');
const jwt = require('jsonwebtoken');
const secret = config.authentication.jwtSecret;
const crypto = require('crypto');
const url = require('url')


const transporter = nodemailer.createTransport(sendGridTransport({
auth: {
    api_key: config.node_mailer_key
}
}));


module.exports = {
 async checkUserNameUnique(req, res, next){
  const { username } =  req.body;
  const userName = await User.findOne({username: username});
  if(!userName){
    return res.status(200).json({message: 'Username not found', usernameExists: false});
  }
  return res.status(200).json({message: 'Username already exists!', usernameExists: true});
 },

 async checkEmailUnique(req, res, next){
  const { email } =  req.body;
  const userEmail = await User.findOne({email: email});
  if(!userEmail){
    return res.status(200).json({message: 'Email not found', emailExists: false});
  }
  return res.status(200).json({message: 'Email already exists!', emailExists: true});
 },

 async userRegistration(req, res, next){
     let statusCode;
     const { username, email, password, gender, birthdate, ethnicity } =  req.body;
     const userName = await User.findOne({username: username});
     if(userName){
         statusCode = 422;
         return res.status(422).json({message: 'Username already exists!', statusCode: statusCode});
     }
     const userEmail = await User.findOne({email: email});
     if(userEmail){
         statusCode = 422;
         return res.status(422).json({message: 'That Email already exists!', statusCode: statusCode});
     }
     const hashedPassword = bcrypt.hashSync(password, 12);


     const newUser = new User({
         random: 'false',
         username: username,
         email: email,
         password: hashedPassword,
         gender: gender,
         birthdate: birthdate,
         age: moment(new Date(), 'MM/DD/YYYY').diff(moment(birthdate, 'MM/DD/YYYY'), 'years'),
         ethnicity: ethnicity,
         onlineStatus: false,
         seekingGender: '',
         height: '',
         relationshipTypeSeeking: '',
         hairColor: '',
         eyeColor: '',
         highestEducation: '',
         secondLanguage: '',
         bodyType:'',
         postalCode: '',
         city:'',
         state:'',
         martialStatus: '',
         hasChildren: false,
         doesSmoke: false,
         doesDoDrugs: false,
         doesDrink: false,
         religion: '',
         profession: '',
         doesHavePets: false,
         ambitiousness: '',
         datingIntent: '',
         longestRelationShip: '',
         income: '',
         doesDateInteracially: false,
         interacialDatingPreferences: [],
         raceDatingPreferences: [],
         isProfileCompleted: false,
         isPremiumUser: false,
         blockedUsers: { users: []},
         favorites: { users: []},
         profileViews: {views: []},
     })
     const savedUser = await newUser.save();
     if(!savedUser){
         statusCode = 500;
         return res.status(500).json({message: `There was an error saving a new user please try again `, statusCode: statusCode});
     }

     transporter.sendMail({
         to: email,
         from: 'ImSeekingGeeks',
         subject: 'Welcome to ImSeekingGeeks',
         html: `
         <h1>Welcome, ${newUser.username} to ImSeekingGeeks</h1>
         <div>
             <ol>
                <li>Search for matches</li>
                <li>Tell us About yourself</li>
                <li>Be yourself have fun</li>
             </ol>

             <h2>Mobile App:</h2>
             <p>Coming Soon</p>
         </div>
         `
     })
     statusCode = 200;
     return res.status(200).json({message: 'User succesfully signed up! Please login.', user: savedUser, statusCode: statusCode})
 },


 async userLogin(req, res, next){
     let statusCode;
     const {username , password } = req.body;
     const user = await User.findOne({username: username});
     if(!user){
         statusCode = 403;
         return res.status(403).json({message: 'Invalid username/password. Please try again.',  statusCode: statusCode});
     }
     // Unecrypted password
    const passwordMatch = (password === user.password) ? true : false;
      // Ecrypted password
     //const passwordMatch = bcrypt.compareSync(password, user.password);
     if(!passwordMatch){
         statusCode = 403;
         return res.status(403).json({message: 'Invalid username/password. Please try again.'});
     }


     await user.updateUserAge();
     const returnedUser = await User.findOne({username: username}).select(["-password", "-blockedUsers.users", "-profileViews.views", "-favorites.users", "-relationshipTypeSeeking", "-profession", "-longestRelationShip", "-ambitiousness", "-datingIntent"])
     const token = jwt.sign({
          email: user.email,
          userId: user._id.toString()
         }, secret, {expiresIn: '1h'});
     user.onlineStatus = true;
     user.save();
     const decodedToken = jwt.verify(token, secret);
     res.status(200).json({token: token, user: returnedUser, tokenExpiresIn: decodedToken.exp});
 },

 async userLogout(req, res, next){
     const { userId } = req.body;
     const user1 = await User.findOne({_id: userId});
    //  if(!user1){
    //      return res.status(401).json({message: 'User 1 Not authneticated'});
    //  }
     user1.onlineStatus = false;
     const userSaved = user1.save();
     if(!userSaved){
         return res.status(500).json({message: 'User 1 Not saved'});
     }
     return res.status(200).json({message: 'Status updated succesfully.'});
 },


   async resetPassword(req, res, next){
       const { email } = req.body;
       console.log(`Searching for user.....`);
       try {
             const user = await User.findOne({email: email}, {password: 0});
                if(!user){
                    console.log(`User doesnt exists.`);
                    return res.status(200).json({message: "No user account with that email exists."});
                }

                const token = jwt.sign({
                    email: user.email,
                    userId: user._id.toString(),
                    password: user.password,
                    }, secret, {expiresIn: '1h'});

                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000;
                const updatedUser = await user.save();
                let hostname = req.headers.host;
                if(updatedUser){
                    
                    transporter.sendMail({
                        to: user.email,
                        from: 'ImSeekingGeeks',
                        subject: 'Password Reset for ImSeekingGeeks',
                        html: `
                        <h1></h1>
                        <div>
                           If you requested a password reset click the link below to reset your password.
                           Click this <a href="http://${hostname}/updatepassword/user/${user._id.toString()}/token/${token}/">link</a> to set a new password.
                        </div>
                        `
                    })

                    return res.status(200).json({message: "If a user with that account exists you will recieve an email within the hour with password reset instructions."});
                }
             } catch(err){
                console.log(err);
             }
         
   },


    async updatePassword(req, res, next){
        const { userId, token , password } = req.body;
        const  user = User.findOne({_id: userId}, {password: 0});
        if(!user){
            return res.status(422).json({message: "We could not find the user in the system."});
        }

        const hashedPassword = bcrypt.hashSync(password, 12);

        user.password = hashedPassword;
        const savedPassword = await user.save();
        return res.status(200).json({message: "Password updated successfully!"});
    }   


}



