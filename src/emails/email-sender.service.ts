import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter() {
    // Configuration AWS SES avec credentials SMTP
    const sesSmtpHost = this.configService.get('SES_SMTP_HOST');
    const sesFromEmail = this.configService.get('SES_FROM_EMAIL');
    const sesFromName = this.configService.get('SES_FROM_NAME');

    // Utiliser les credentials SMTP AWS SES (pas les credentials IAM)
    const sesSmtpUser =
      this.configService.get('SES_SMTP_USERNAME') ||
      this.configService.get('AWS_ACCESS_KEY_ID');
    const sesSmtpPass =
      this.configService.get('SES_SMTP_PASSWORD') ||
      this.configService.get('AWS_SECRET_ACCESS_KEY');

    if (sesSmtpHost && sesSmtpUser && sesSmtpPass) {
      this.logger.log('Using AWS SES SMTP for email delivery');
      this.logger.log(`SES Host: ${sesSmtpHost}`);
      this.logger.log(`From Email: ${sesFromEmail}`);

      this.transporter = nodemailer.createTransport({
        host: sesSmtpHost,
        port: 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: sesSmtpUser,
          pass: sesSmtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });
      return;
    }

    // Configuration SMTP fallback
    const smtpConfig = {
      host: this.configService.get('SMTP_HOST', 'smtp.gmail.com'),
      port: parseInt(this.configService.get('SMTP_PORT', '587')),
      secure: this.configService.get('SMTP_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    };

    // Si pas de configuration SMTP, utiliser un transporteur de test
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      this.logger.warn('No email credentials configured, using test account');
      this.createTestTransporter();
    } else {
      this.transporter = nodemailer.createTransport(smtpConfig);
    }
  }

  private async createTestTransporter() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      this.transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      this.logger.log(`Test email account created: ${testAccount.user}`);
    } catch (error) {
      this.logger.error('Failed to create test email account', error);
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const fromEmail =
        this.configService.get('SES_FROM_EMAIL') ||
        this.configService.get('SMTP_FROM', 'noreply@bricola.com');
      const fromName = this.configService.get('SES_FROM_NAME', 'BRICOLA-LTD');

      const mailOptions = {
        from: `${fromName} <${fromEmail}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);

      // Si c'est un compte de test, afficher l'URL de prévisualisation
      if (info.messageId && nodemailer.getTestMessageUrl(info)) {
        this.logger.log(`Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }

      this.logger.log(`Email sent successfully to ${options.to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      return false;
    }
  }

  async sendVerificationEmail(
    email: string,
    verificationToken: string,
    verificationCode?: string,
  ): Promise<boolean> {
    const verificationUrl = `${this.configService.get('FRONTEND_URL', 'http://localhost:3000')}/verify-email?token=${verificationToken}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Vérification de votre email</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #007bff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BRICOLA-LTD</h1>
          </div>
          <div class="content">
            <h2>Vérifiez votre adresse email</h2>
            <p>Bonjour,</p>
            <p>Merci de vous être inscrit sur BRICOLA-LTD ! Pour finaliser votre inscription, vous avez deux options :</p>
            
            <div style="margin: 30px 0; padding: 20px; background: #fff; border-radius: 8px; border-left: 4px solid #007bff;">
              <h3 style="margin-top: 0; color: #007bff;">Option 1 : Cliquez sur le lien</h3>
              <p style="text-align: center;">
                <a href="${verificationUrl}" class="button">Vérifier mon email</a>
              </p>
              <p>Ou copiez ce lien dans votre navigateur :</p>
              <p style="word-break: break-all; font-size: 12px; color: #666;">${verificationUrl}</p>
            </div>
            
            ${
              verificationCode
                ? `
            <div style="margin: 30px 0; padding: 20px; background: #fff; border-radius: 8px; border-left: 4px solid #28a745;">
              <h3 style="margin-top: 0; color: #28a745;">Option 2 : Utilisez ce code</h3>
              <p>Entrez ce code de vérification sur la page de vérification :</p>
              <div style="text-align: center; margin: 20px 0;">
                <span style="display: inline-block; padding: 15px 25px; background: #f8f9fa; border: 2px solid #28a745; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #28a745;">${verificationCode}</span>
              </div>
              <p style="font-size: 14px; color: #666;">Ce code expire dans 15 minutes.</p>
            </div>
            `
                : ''
            }
            
            <p style="margin-top: 30px;">Le lien expirera dans 24 heures.</p>
            <p>Si vous n'avez pas créé de compte sur BRICOLA-LTD, vous pouvez ignorer cet email.</p>
          </div>
          <div class="footer">
            <p>© 2025 BRICOLA-LTD. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
      Vérifiez votre adresse email
      
      Bonjour,
      
      Merci de vous être inscrit sur BRICOLA-LTD ! Pour finaliser votre inscription, vous avez deux options :
      
      Option 1 : Cliquez sur ce lien
      ${verificationUrl}
      
      ${
        verificationCode
          ? `Option 2 : Utilisez ce code de vérification
      Code : ${verificationCode}
      (Ce code expire dans 15 minutes)
      
      `
          : ''
      }Le lien expirera dans 24 heures.
      
      Si vous n'avez pas créé de compte sur BRICOLA-LTD, vous pouvez ignorer cet email.
      
      © 2025 BRICOLA-LTD. Tous droits réservés.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Vérifiez votre adresse email - BRICOLA-LTD',
      html,
      text,
    });
  }

  async sendPasswordResetEmail(
    email: string,
    resetCode: string,
  ): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Réinitialisation de votre mot de passe</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .code-box { text-align: center; margin: 30px 0; padding: 20px; background: #fff; border-radius: 8px; border-left: 4px solid #dc3545; }
          .code { display: inline-block; padding: 15px 25px; background: #f8f9fa; border: 2px solid #dc3545; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; color: #dc3545; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>BRICOLA-LTD</h1>
          </div>
          <div class="content">
            <h2>Réinitialisation de votre mot de passe</h2>
            <p>Bonjour,</p>
            <p>Vous avez demandé la réinitialisation de votre mot de passe. Utilisez le code ci-dessous pour procéder à la réinitialisation :</p>
            <div class="code-box">
              <h3 style="margin-top: 0; color: #dc3545;">Code de réinitialisation</h3>
              <div class="code">${resetCode}</div>
              <p style="font-size: 14px; color: #666; margin-bottom: 0;">Ce code expire dans 15 minutes.</p>
            </div>
            <p>Entrez ce code sur la page de réinitialisation de mot de passe pour continuer.</p>
            <p>Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
          </div>
          <div class="footer">
            <p>© 2025 BRICOLA-LTD. Tous droits réservés.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Réinitialisation de votre mot de passe

Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe.

Voici votre code de réinitialisation :
${resetCode}

Entrez ce code sur la page de réinitialisation de mot de passe pour continuer.

Ce code expire dans 15 minutes.

Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.

© 2025 BRICOLA-LTD. Tous droits réservés.
    `;

    return this.sendEmail({
      to: email,
      subject: 'Réinitialisation de votre mot de passe - BRICOLA-LTD',
      html,
      text,
    });
  }
}
