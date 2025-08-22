// routes/contact.js
const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { sendContactMail } = require('../services/mailer');

const router = express.Router();

// rate limiter
const contactLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, error: 'Too many requests, try again later.' },
});

// HTML escape utility
function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

router.post(
  '/',
  contactLimiter,
  [
    body('name').trim().notEmpty().withMessage('Name required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('subject').trim().notEmpty().withMessage('Subject required').isLength({ max: 200 }),
    body('message').trim().notEmpty().withMessage('Message required').isLength({ max: 2000 }),
    body('category')
      .isIn(['general', 'technical', 'billing', 'account', 'feedback'])
      .withMessage('Invalid category'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ ok: false, errors: errors.array() });
    }

    const { name, email, subject, message, category } = req.body;

    // HTML body for email
    const html = `
      <h3>New Support Message</h3>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Category:</strong> ${escapeHtml(category)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
      <p><strong>Message:</strong><br/>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>
      <hr/>
      <p>Sent from Support Form</p>
    `;

    // Plain text body
    const text = `
Name: ${name}
Email: ${email}
Category: ${category}
Subject: ${subject}
Message:
${message}
    `;

    try {
      await sendContactMail({
        subject: `[${category.toUpperCase()}] ${subject} - from ${name}`,
        text,
        html,
        replyTo: email, // so owner can click reply to respond to user
      });

      return res.json({ ok: true, message: 'Message sent successfully' });
    } catch (err) {
      console.error('Error sending contact mail:', err);
      return res.status(500).json({ ok: false, error: 'Unable to send message at this time' });
    }
  }
);

module.exports = router;
