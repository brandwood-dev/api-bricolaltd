import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from './entities/wallet.entity';
import { CreateWalletDto } from './dto/create-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';
import { Transaction } from '../transactions/entities/transaction.entity';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';

@Injectable()
export class WalletsService {
  constructor(
    @InjectRepository(Wallet)
    private walletsRepository: Repository<Wallet>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
  ) {}

  async create(createWalletDto: CreateWalletDto): Promise<Wallet> {
    const existingWallet = await this.walletsRepository.findOne({
      where: { userId: createWalletDto.userId },
    });

    if (existingWallet) {
      throw new BadRequestException('User already has a wallet');
    }

    const wallet = this.walletsRepository.create(createWalletDto);
    return this.walletsRepository.save(wallet);
  }

  async findAll(): Promise<Wallet[]> {
    return this.walletsRepository.find();
  }

  async findOne(id: string): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOne({ where: { id } });
    if (!wallet) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }
    return wallet;
  }

  async findByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletsRepository.findOne({ where: { userId } });
    if (!wallet) {
      throw new NotFoundException(`Wallet for user with ID ${userId} not found`);
    }
    return wallet;
  }

  async update(id: string, updateWalletDto: UpdateWalletDto): Promise<Wallet> {
    const wallet = await this.findOne(id);
    Object.assign(wallet, updateWalletDto);
    return this.walletsRepository.save(wallet);
  }

  async remove(id: string): Promise<void> {
    const result = await this.walletsRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Wallet with ID ${id} not found`);
    }
  }

  async addFunds(id: string, amount: number): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.findOne(id);
    wallet.balance = Number(wallet.balance) + amount;
    return this.walletsRepository.save(wallet);
  }

  /**
   * Ajoute des fonds disponibles (pour les revenus de location)
   * Met à jour à la fois le balance cumulé ET le solde disponible
   */
  async addAvailableFunds(id: string, amount: number): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.findOne(id);
    // Mettre à jour le balance cumulé (total des gains)
    wallet.balance = Number(wallet.balance) + amount;
    // Mettre à jour le solde disponible pour retrait
    wallet.reservedBalance = Number(wallet.reservedBalance) + amount;
    
    console.log(`[WALLET_UPDATE] Adding available funds to wallet ${id}: +${amount}€`);
    console.log(`[WALLET_UPDATE] New balance: ${wallet.balance}€, New available: ${wallet.reservedBalance}€`);
    
    return this.walletsRepository.save(wallet);
  }

  async deductFunds(id: string, amount: number): Promise<Wallet> {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const wallet = await this.findOne(id);
    if (Number(wallet.balance) < amount) {
      throw new BadRequestException('Insufficient funds');
    }

    wallet.balance = Number(wallet.balance) - amount;
    return this.walletsRepository.save(wallet);
  }

  async calculateBalance(userId: string): Promise<{ balance: number }> {
    // Calcul du solde selon la formule :
    // SUM(transactions.amount WHERE type in ('rental_income','deposit') AND status='completed') 
    // - SUM(transactions.amount WHERE type in ('withdrawal','payment') AND status='completed')
    
    const incomeResult = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.recipientId = :userId', { userId })
      .andWhere('transaction.type IN (:...types)', { 
        types: [TransactionType.RENTAL_INCOME, TransactionType.DEPOSIT] 
      })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();

    const outgoingResult = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('COALESCE(SUM(transaction.amount), 0)', 'total')
      .where('transaction.senderId = :userId', { userId })
      .andWhere('transaction.type IN (:...types)', { types: [TransactionType.WITHDRAWAL, TransactionType.PAYMENT] })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();

    const income = parseFloat(incomeResult.total) || 0;
    const outgoing = parseFloat(outgoingResult.total) || 0;
    const balance = income - outgoing;

    return { balance };
  }

  async calculateStats(userId: string): Promise<{
    cumulativeBalance: number;
    availableBalance: number;
    pendingBalance: number;
    successfulTransactionsCount: number;
  }> {
    // Récupérer le wallet de l'utilisateur avec les vraies valeurs de la DB
    const wallet = await this.findByUserId(userId);

    // Comptage des transactions réussies (paiements + retraits + revenus de location)
    const successfulTransactionsResult = await this.transactionsRepository
      .createQueryBuilder('transaction')
      .select('COUNT(*)', 'count')
      .where('(transaction.senderId = :userId OR transaction.recipientId = :userId)', { userId })
      .andWhere('transaction.type IN (:...types)', { 
        types: [TransactionType.PAYMENT, TransactionType.WITHDRAWAL, TransactionType.RENTAL_INCOME] 
      })
      .andWhere('transaction.status = :status', { status: TransactionStatus.COMPLETED })
      .getRawOne();

    const successfulTransactionsCount = parseInt(successfulTransactionsResult.count) || 0;

    // Utiliser directement les champs de la base de données
    return {
      cumulativeBalance: parseFloat(wallet.balance.toString()) || 0, // balance = total des gains cumulés
      availableBalance: parseFloat(wallet.reservedBalance.toString()) || 0, // reserved_balance = solde disponible pour retrait
      pendingBalance: parseFloat(wallet.pendingBalance.toString()) || 0, // pending_balance = solde en attente
      successfulTransactionsCount
    };
  }

  async createWithdrawal(userId: string, amount: number, accountDetails?: any): Promise<Transaction> {
    // Vérifier le seuil minimum (50€)
    const minimumThreshold = 50;
    if (amount < minimumThreshold) {
      throw new BadRequestException(`Le montant minimum de retrait est de ${minimumThreshold}€`);
    }

    // Vérifier le solde disponible
    const { balance } = await this.calculateBalance(userId);
    if (balance < amount) {
      throw new BadRequestException('Solde insuffisant pour effectuer ce retrait');
    }

    // Récupérer le wallet de l'utilisateur
    const wallet = await this.findByUserId(userId);

    // Créer la transaction de retrait avec status PENDING
    const withdrawalTransaction = this.transactionsRepository.create({
      amount,
      type: TransactionType.WITHDRAWAL,
      status: TransactionStatus.PENDING,
      senderId: userId,
      recipientId: userId, // Pour les retraits, sender et recipient sont le même utilisateur
      walletId: wallet.id,
      description: `Demande de retrait de ${amount}€`,
      externalReference: accountDetails ? JSON.stringify(accountDetails) : undefined,
    });

    return this.transactionsRepository.save(withdrawalTransaction);
  }
}