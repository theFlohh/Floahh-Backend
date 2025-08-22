const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

transporter.verify()
  .then(() => console.log('✅ Mailer verified and ready'))
  .catch((err) => console.error('❌ Mailer verify failed:', err));

async function sendContactMail({ subject, text, html, replyTo }) {
  const info = await transporter.sendMail({
    from: `<${process.env.GMAIL_USER}>`,
    to: process.env.OWNER_EMAIL,
    subject,
    text,
    html,
    replyTo,
  });
  console.log(info,"gmail")
  return info;

}

module.exports = { sendContactMail, transporter };
