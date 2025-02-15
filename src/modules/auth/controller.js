const Auth  = require('./model')
const { validator } = require('../../utils/validator')
const { authValidatorSchema, emailValidatorSchema, passwordValidatorSchema } = require('./schema')
const { generateToken, generateEmailVerificationLink, generatePasswordResetLink, verifyLink } = require('../../utils/token')
const { hashPassword, comparePasswords } = require('../../utils/hasher')
const  MailService  = require('./mailService')



//user signup handler
exports.signup = async (req, res) => {
        try {
            //validate user inputs
            let data = await validator(req.body, authValidatorSchema)
            if (!data.isValid){
                throw data.error
            }
            let {email, password} = data.value
            
            await Auth.createUser(email, password)
            //send success message
            res.status(200).json({
                success: "Verification mail sent successfully"
            })
        } 
        catch (err) {
            res.status(400).json({error: err.message})
        }        
}



//email account verification
exports.verifyMail =  async(req, res) => {
        let verificationLink = req.params.link

        try {
            let user = await verifyLink(verificationLink)
            console.log(user)//log
            if(!user){
                throw new Error("Link expired")
            }
            
            //update account status
            let { email } = user
            let updated =  await Auth.updateUser({ email }, {status: "active"})
            console.log(updated)

            res.status(200).json({
                message: "Account verified"
            })
        } 
        catch (err) {
            res.status(400).json({
                error: err.message
            })
        }
    }


exports.signin = async (req, res) => {
        let { email, password } = req.body

        try {
            email = email.toLowerCase()
            let user = { email, password}

            //validate user inputs
            let data = await validator(user, authValidatorSchema)
            if (!data.isValid){
                throw data.error
            }

            console.log(data)

            //check user credentials
            user = await Auth.getUser(email)
            if (!user){
                throw new Error("Wrong password or email combination")
            }

            let hashedPassword = user.password
            let compared = await comparePasswords(password, hashedPassword)
            if(!compared){
                throw new Error("Wrong password or email combination")
            }

            //filter result from db
            user = {
                id: user._id,
                email: user.email
            }

            //generate jwt token
            let token = generateToken(user)

            res.cookie("jwt", token, {
                maxAge: 3600 * 24 * 10 * 1000, // 10 days
                secure: true,
                httpOnly: true
            })
            res.status(200).json(user)


        } catch (err) {
            res.status(400).json({
                error: err.message
            })
        }
    }

exports.signout =  async(req, res) => {
        //clear cookies
        res.clearCookie('jwt')
}

exports.forgetPassword = async(req, res) => {
        let { email } = req.body

        try {
            //validate user inputs
            let data = await validator(user, emailValidatorSchema)
            if (!data.isValid){
                throw data.error
            }

            //find email on the db
            let user = await Auth.getUser(email)

            //filter user object
            user = {
                id: user._id,
                email: user.email
            }
            //generate password reset email
            let passwordResetLink = await generatePasswordResetLink(user)
            let mailData = {
                to: user.email,
                passwordResetLink
            }
            await MailService.sendPasswordResetMail(mailData)

            res.status(200).json({
                success: "Password reset link sent..."
            })

        } catch (err) {
            res.status(400).json({
                error: err.message
            })
        }
    }

exports.resetPassword =  async(req, res) => {
        let passwordResetLink = req.params.link
        let { password } = req.body

        try {
            //verify password reset link
            let user = await verifyLink(passwordResetLink)
            console.log(user)//log
            if(!user){
                throw  new Error("Link expired")
            }
            let { email } = user

            //validate user inputs
            let data = await validator(user, passwordValidatorSchema)
            if (!data.isValid){
                throw data.error
            }

            //hash new password
            let hashedPassword = await hashPassword(password)

            //update and save new password
            await Auth.updateUser(email, { password: hashedPassword })

            res.status(200).json({
                success: "password reset successful"
            })


        } 
        catch (err) {
            res.status(400).json({
                error: err.message
            })
        }
    }