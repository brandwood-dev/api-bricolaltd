import { DataSource } from 'typeorm';
import { Document } from '../documents/entities/document.entity';
import { User } from '../users/entities/user.entity';
import { Tool } from '../tools/entities/tool.entity';
import { DocumentType } from '../documents/enums/document-type.enum';
import { faker } from '@faker-js/faker';

export async function seedDocuments(dataSource: DataSource) {
  console.log('📄 Seeding documents...');

  const documentRepository = dataSource.getRepository(Document);
  const userRepository = dataSource.getRepository(User);
  const toolRepository = dataSource.getRepository(Tool);

  const users = await userRepository.find({
    where: { isAdmin: false },
    take: 10,
  });
  const tools = await toolRepository.find({ take: 5 });

  if (users.length === 0) {
    console.log('⚠️ No users found, skipping documents seeding');
    return;
  }

  if (tools.length === 0) {
    console.log(
      '⚠️ No tools found, documents will be created without tool associations',
    );
  }

  const documentTypes = Object.values(DocumentType);
  const mimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/msword',
  ];
  const documentTitles = {
    [DocumentType.ID_CARD]: ['Identity Card', 'National ID', 'Citizen Card'],
    [DocumentType.PASSPORT]: [
      'Passport',
      'Travel Document',
      'International Passport',
    ],
    [DocumentType.DRIVER_LICENSE]: [
      'Driver License',
      'Driving Permit',
      'Vehicle License',
    ],
    [DocumentType.CONTRACT]: [
      'Rental Contract',
      'Service Agreement',
      'Tool Rental Agreement',
    ],
    [DocumentType.INVOICE]: [
      'Purchase Invoice',
      'Tool Invoice',
      'Service Invoice',
    ],
    [DocumentType.IDENTITY]: [
      'Identity Document',
      'Personal ID',
      'Identity Proof',
    ],
    [DocumentType.PROOF_OF_PAYMENT]: [
      'Payment Proof',
      'Payment Receipt',
      'Transaction Proof',
    ],
    [DocumentType.RECEIPT]: ['Receipt', 'Purchase Receipt', 'Service Receipt'],
    [DocumentType.PAYMENT_SLIP]: ['Payment Slip', 'Bank Slip', 'Transfer Slip'],
    [DocumentType.VEHICLE_REGISTRATION]: [
      'Vehicle Registration',
      'Car Registration',
      'Vehicle Papers',
    ],
  };

  // Generate 80 realistic documents
  for (let i = 0; i < 80; i++) {
    const type = faker.helpers.arrayElement(documentTypes);
    const mimeType = faker.helpers.arrayElement(mimeTypes);
    const extension = mimeType.includes('pdf')
      ? 'pdf'
      : mimeType.includes('jpeg')
        ? 'jpg'
        : mimeType.includes('png')
          ? 'png'
          : 'doc';
    const fileName = `${faker.string.alphanumeric(8)}_${Date.now()}_${i}.${extension}`;

    const documentData: any = {
      type,
      title: faker.helpers.arrayElement(documentTitles[type]),
      fileName,
      originalName: `${faker.lorem.word()}_${faker.lorem.word()}.${extension}`,
      fileUrl: `https://bricola-bucket.s3.amazonaws.com/documents/${fileName}`,
      path: `uploads/documents/${fileName}`,
      size: faker.number.int({ min: 100000, max: 5000000 }),
      mimeType,
      isVerified: faker.datatype.boolean({ probability: 0.7 }),
      description: faker.lorem.sentence(),
    };
    const user = users[i % users.length];
    const tool = tools.length > 0 ? tools[i % tools.length] : null;

    const existingDocument = await documentRepository.findOne({
      where: { fileName: documentData.fileName },
    });

    if (!existingDocument) {
      const document = documentRepository.create({
        ...documentData,
        user,
        userId: user.id,
        tool:
          documentData.type === DocumentType.INVOICE && tool ? tool : undefined,
        toolId:
          documentData.type === DocumentType.INVOICE && tool
            ? tool.id
            : undefined,
        verifiedAt: documentData.isVerified ? new Date() : undefined,
      });

      await documentRepository.save(document);
      console.log(`✅ Created document: ${documentData.title}`);
    }
  }

  console.log('📄 Documents seeding completed!');
}
