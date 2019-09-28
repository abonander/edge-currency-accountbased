/**
 * Created by paul on 7/7/17.
 */
// @flow

import * as hedera from '@hashgraph/sdk'
// import { currencyInfo } from './hederaInfo.js'
import {
  type EdgeCurrencyEngineOptions,
  type EdgeSpendInfo,
  type EdgeTransaction,
  type EdgeWalletInfo,
  NoAmountSpecifiedError
} from 'edge-core-js/types'

import { CurrencyEngine } from '../common/engine.js'
import { HederaPlugin } from '../hedera/hederaPlugin.js'
import { type HederaWalletOtherData } from './hederaTypes.js'

export class HederaEngine extends CurrencyEngine {
  hederaPlugin: HederaPlugin
  otherData: HederaWalletOtherData
  client: hedera.Client
  privateKey: hedera.Ed25519PrivateKey

  constructor (
    currencyPlugin: HederaPlugin,
    walletInfo: EdgeWalletInfo,
    opts: EdgeCurrencyEngineOptions
  ) {
    super(currencyPlugin, walletInfo, opts)
    this.log('hedera constructor called', walletInfo)
    this.hederaPlugin = currencyPlugin

    this.privateKey = hedera.Ed25519PrivateKey.fromString(walletInfo.keys.hederaPrivateKey)

    this.client = new hedera.Client({
      operator: {
        account: walletInfo.keys.hederaAccount,
        privateKey: this.privateKey
      }
    })
  }

  // ****************************************************************************
  // Public methods
  // ****************************************************************************

  async startEngine () {
    this.log('hedera start engine called')
    this.engineOn = true
    await this.updateBalance()
    this.addToLoop('updateBalance', 5000)
    super.startEngine()
  }

  async resyncBlockchain (): Promise<void> {
    await this.killEngine()
    await this.startEngine()
  }

  async updateBalance (): Promise<void> {
    console.log('hedera updateBalance', this)
    const balance = (await this.client.getAccountBalance()).toString()
    this.log('got balance:', balance)
    this.walletLocalData.totalBalances['HBAR'] = balance
    this.currencyEngineCallbacks.onBalanceChanged('HBAR', balance)
  }

  async makeSpend (edgeSpendInfoIn: EdgeSpendInfo): Promise<EdgeTransaction> {
    const {
      edgeSpendInfo,
      currencyCode
    } = super.makeSpend(edgeSpendInfoIn)

    if (edgeSpendInfo.spendTargets.length !== 1) {
      throw new Error('Error: only one output allowed')
    }
    const publicAddress = edgeSpendInfo.spendTargets[0].publicAddress

    let nativeAmount = '0'
    if (typeof edgeSpendInfo.spendTargets[0].nativeAmount === 'string') {
      nativeAmount = edgeSpendInfo.spendTargets[0].nativeAmount
    } else {
      throw new NoAmountSpecifiedError()
    }

    const hbar = hedera.Hbar.fromTinybar(nativeAmount)
    const txnFee = hedera.Hbar.fromTinybar(900000)

    const transferTx = new hedera.CryptoTransferTransaction(this.client)
      .addSender(this.client.operator.account, hbar)
      .addRecipient(publicAddress, hbar)
      .setTransactionFee(txnFee)
      .build()

    const txnId = transferTx.getTransactionId()
    const { account: { shard, realm, account }, validStartSeconds, validStartNanos } = txnId

    const txnDate = new Date(
      (validStartSeconds * 1000) + Math.floor(validStartNanos / 1000000)
    )

    const edgeTransaction: EdgeTransaction = {
      txid: `${shard}.${realm}.${account}@${validStartSeconds}.${validStartNanos}`, // txid
      date: txnDate.getTime(), // date
      currencyCode, // currencyCode
      blockHeight: 0, // blockHeight
      nativeAmount: hbar.negated().asTinybar().toString(),
      // UI shows the fee subtracted from the sent amount which doesn't make sense here
      networkFee: '0', // networkFee
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: '', // signedTx
      otherParams: {
        fromAddress: this.walletLocalData.publicKey,
        toAddress: publicAddress,
        transferTx: transferTx.toBytes()
      }
    }

    this.log(
      `${nativeAmount} ${this.walletLocalData.publicKey} -> ${publicAddress}`
    )
    return edgeTransaction
  }

  async signTx (edgeTransaction: EdgeTransaction): Promise<EdgeTransaction> {
    const transferTx = hedera.Transaction.fromBytes(this.client, edgeTransaction.otherParams.transferTx)
    await transferTx.sign(this.privateKey)

    return {
      ...edgeTransaction,
      otherParams: {
        ...edgeTransaction.otherParams,
        signedTx: transferTx.toBytes()
      }
    }
  }

  async broadcastTx (
    edgeTransaction: EdgeTransaction
  ): Promise<EdgeTransaction> {
    try {
      const { signedTx } = edgeTransaction.otherParams
      await hedera.Transaction.fromBytes(this.client, signedTx)
        .executeForReceipt()
    } catch (e) {
      this.log(e)
      throw e
    }
    // must be > 0 to not show "Synchronizing"
    edgeTransaction.blockHeight = 1
    return edgeTransaction
  }

  getDisplayPrivateSeed () {
    return this.privateKey.toString()
  }

  getDisplayPublicSeed () {
    return this.client.operatorPublicKey.toString()
  }
}

export { CurrencyEngine }
