import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, ContactStatus, ContactCategory, ContactPriority } from './entities/contact.entity';
import { CreateContactDto } from './dto/create-contact.dto';
import { EmailSenderService } from '../emails/email-sender.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    private emailSenderService: EmailSenderService,
    private configService: ConfigService,
  ) {}

  async create(createContactDto: CreateContactDto): Promise<Contact> {
    // Create contact record in database
    const contact = this.contactRepository.create({
      ...createContactDto,
      status: ContactStatus.NEW,
      priority: ContactPriority.MEDIUM,
    });

    const savedContact = await this.contactRepository.save(contact);

    // Send notification email to admin
    await this.sendAdminNotification(savedContact);

    // Send confirmation email to user
    await this.sendUserConfirmation(savedContact);

    return savedContact;
  }

  async findAll(): Promise<Contact[]> {
    return this.contactRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findOne({ where: { id } });
    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }
    return contact;
  }

  async updateStatus(id: string, status: ContactStatus): Promise<Contact> {
    const contact = await this.findOne(id);
    contact.status = status;
    return this.contactRepository.save(contact);
  }

  async assignTo(id: string, assignedTo: string): Promise<Contact> {
    const contact = await this.findOne(id);
    contact.assignedTo = assignedTo;
    contact.status = ContactStatus.IN_PROGRESS;
    return this.contactRepository.save(contact);
  }

  async respond(id: string, response: string): Promise<Contact> {
    const contact = await this.findOne(id);
    contact.response = response;
    contact.respondedAt = new Date();
    contact.status = ContactStatus.RESOLVED;
    
    const updatedContact = await this.contactRepository.save(contact);

    // Send response email to user
    await this.sendResponseEmail(updatedContact);

    return updatedContact;
  }

  async remove(id: string): Promise<void> {
    const contact = await this.findOne(id);
    await this.contactRepository.remove(contact);
  }

  private async sendAdminNotification(contact: Contact): Promise<void> {
    try {
      const adminEmail = this.configService.get('SES_FROM_EMAIL') || 'admin@bricolaltd.com';
      
      await this.emailSenderService.sendEmail({
        to: adminEmail,
        subject: `Nouveau message de contact - ${contact.subject}`,
        html: `
          <h2>Nouveau message de contact reçu</h2>
          <p><strong>De:</strong> ${contact.firstName} ${contact.lastName}</p>
          <p><strong>Email:</strong> ${contact.email}</p>
          ${contact.phone ? `<p><strong>Téléphone:</strong> ${contact.phone}</p>` : ''}
          <p><strong>Sujet:</strong> ${contact.subject}</p>
          <p><strong>Message:</strong></p>
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 10px 0;">
            ${contact.message.replace(/\n/g, '<br>')}
          </div>
          <p><strong>Date:</strong> ${contact.createdAt.toLocaleString('fr-FR')}</p>
          <p><strong>ID du contact:</strong> ${contact.id}</p>
          <hr>
          <p><em>Connectez-vous à l'interface d'administration pour répondre à ce message.</em></p>
        `,
        text: `
          Nouveau message de contact reçu\n\n
          De: ${contact.firstName} ${contact.lastName}\n
          Email: ${contact.email}\n
          ${contact.phone ? `Téléphone: ${contact.phone}\n` : ''}
          Sujet: ${contact.subject}\n\n
          Message:\n
          ${contact.message}\n\n
          Date: ${contact.createdAt.toLocaleString('fr-FR')}\n
          ID du contact: ${contact.id}
        `,
      });
    } catch (error) {
      console.error('Failed to send admin notification email:', error);
      // Don't throw error to avoid blocking contact creation
    }
  }

  private async sendUserConfirmation(contact: Contact): Promise<void> {
    try {
      await this.emailSenderService.sendEmail({
        to: contact.email,
        subject: 'Confirmation de réception de votre message - Bricola',
        html: `
          <h2>Merci pour votre message !</h2>
          <p>Bonjour ${contact.firstName},</p>
          <p>Nous avons bien reçu votre message concernant "${contact.subject}" et nous vous remercions de nous avoir contactés.</p>
          <p>Notre équipe examine votre demande et vous répondra dans les plus brefs délais, généralement sous 24-48 heures.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Récapitulatif de votre message :</h3>
            <p><strong>Sujet:</strong> ${contact.subject}</p>
            <p><strong>Message:</strong></p>
            <p style="font-style: italic;">${contact.message.replace(/\n/g, '<br>')}</p>
          </div>
          <p>Si votre demande est urgente, vous pouvez également nous contacter par téléphone au +44 203 996 0821.</p>
          <p>Cordialement,<br>L'équipe Bricola</p>
          <hr>
          <p style="font-size: 12px; color: #666;">Référence: ${contact.id}</p>
        `,
        text: `
          Merci pour votre message !\n\n
          Bonjour ${contact.firstName},\n\n
          Nous avons bien reçu votre message concernant "${contact.subject}" et nous vous remercions de nous avoir contactés.\n\n
          Notre équipe examine votre demande et vous répondra dans les plus brefs délais, généralement sous 24-48 heures.\n\n
          Récapitulatif de votre message :\n
          Sujet: ${contact.subject}\n
          Message: ${contact.message}\n\n
          Si votre demande est urgente, vous pouvez également nous contacter par téléphone au +44 203 996 0821.\n\n
          Cordialement,\n
          L'équipe Bricola\n\n
          Référence: ${contact.id}
        `,
      });
    } catch (error) {
      console.error('Failed to send user confirmation email:', error);
      // Don't throw error to avoid blocking contact creation
    }
  }

  private async sendResponseEmail(contact: Contact): Promise<void> {
    try {
      await this.emailSenderService.sendEmail({
        to: contact.email,
        subject: `Réponse à votre message: ${contact.subject} - Bricola`,
        html: `
          <h2>Réponse à votre message</h2>
          <p>Bonjour ${contact.firstName},</p>
          <p>Nous vous remercions pour votre message concernant "${contact.subject}". Voici notre réponse :</p>
          <div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
            ${contact.response?.replace(/\n/g, '<br>')}
          </div>
          <p>Si vous avez d'autres questions, n'hésitez pas à nous recontacter.</p>
          <p>Cordialement,<br>L'équipe Bricola</p>
          <hr>
          <p style="font-size: 12px; color: #666;">Référence: ${contact.id}</p>
        `,
        text: `
          Réponse à votre message\n\n
          Bonjour ${contact.firstName},\n\n
          Nous vous remercions pour votre message concernant "${contact.subject}". Voici notre réponse :\n\n
          ${contact.response}\n\n
          Si vous avez d'autres questions, n'hésitez pas à nous recontacter.\n\n
          Cordialement,\n
          L'équipe Bricola\n\n
          Référence: ${contact.id}
        `,
      });
    } catch (error) {
      console.error('Failed to send response email:', error);
      // Don't throw error to avoid blocking response
    }
  }
}