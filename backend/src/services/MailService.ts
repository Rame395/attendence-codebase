import transporter from "../config/mail.js";

class MailService {

  static async sendWelcomeEmail(
    email: string,
    name: string,
    password: string,
  ) {

    await transporter.sendMail({
      from: process.env.MAIL_USER,

      to: email,

      subject: "Attendance System - Your Account",

      html: `
        <div style="font-family: Arial; padding: 20px">

          <h2>Welcome to Attendance System</h2>

          <p>Hello <b>${name}</b>,</p>

          <p>
            Your account has been created by the administrator.
          </p>

          <p>
            <b>Email:</b> ${email}
          </p>

          <p>
            <b>Temporary Password:</b> ${password}
          </p>

          <p>
            Please use this email and temporary password
            to login.
          </p>

          <p>
            For security, please change your password after
            your first login.
          </p>

        </div>
      `,
    });
  }


  // email change/credential renewal pachhi naya credentials pathaune
  static async sendCredentialsResetEmail(
    email: string,
    name: string,
    password: string,
  ) {

    await transporter.sendMail({
      from: process.env.MAIL_USER,

      to: email,

      subject: "Attendance System - Login Credentials Updated",

      html: `
        <div style="font-family: Arial; padding: 20px">

          <h2>Account Credentials Updated</h2>

          <p>Hello <b>${name}</b>,</p>

          <p>
            Your login credentials for Attendance System have been updated
            by the administrator.
          </p>

          <p>
            <b>Email:</b> ${email}
          </p>

          <p>
            <b>Password:</b> ${password}
          </p>

          <p>
            Please use this email and password to login to the Attendance System.
          </p>

          <p>
            You can change your password anytime from your profile page.
          </p>

        </div>
      `,
    });
  }


  static async sendForgotPasswordCode(
    email: string,
    code: string,
  ) {

    await transporter.sendMail({
      from: process.env.MAIL_USER,

      to: email,

      subject: "Attendance System - Password Reset Code",

      html: `
        <div style="font-family: Arial; padding: 20px">

          <h2>Password Reset</h2>

          <p>
            Your password reset code is:
          </p>

          <h1>${code}</h1>

          <p>
            This code will expire in 10 minutes.
          </p>

        </div>
      `,
    });
  }
}

export default MailService;