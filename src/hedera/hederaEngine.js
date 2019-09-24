/**
 * Created by paul on 7/7/17.
 */
// @flow

import { bns } from 'biggystring'
// import { currencyInfo } from './hederaInfo.js'
import {
  type EdgeCurrencyEngineOptions,
  type EdgeSpendInfo,
  type EdgeTransaction,
  type EdgeWalletInfo,
  InsufficientFundsError,
  NoAmountSpecifiedError
} from 'edge-core-js/types'

import { CurrencyEngine } from '../common/engine.js'
import { asyncWaterfall, getDenomInfo, promiseAny } from '../common/utils.js'
import { HederaPlugin } from '../hedera/hederaPlugin.js'
import {
  type HederaAccount,
  type HederaOperation,
  type HederaTransaction,
  type HederaWalletOtherData
} from './hederaTypes.js'

import * as hedera from '@hashgraph/sdk'

type HederaServerFunction =
  | 'payments'
  | 'loadAccount'
  | 'submitTransaction'

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
    this.walletLocalData.totalBalances['XHB'] = balance
    this.currencyEngineCallbacks.onBalanceChanged('XHB', balance)
  }

  async makeSpend (edgeSpendInfoIn: EdgeSpendInfo): Promise<EdgeTransaction> {
    const {
      edgeSpendInfo,
      currencyCode,
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
      .toBytes()

    const edgeTransaction: EdgeTransaction = {
      txid: '', // txid
      date: 0, // date
      currencyCode, // currencyCode
      blockHeight: 0, // blockHeight
      nativeAmount: hbar.negated().asTinybar().toString(),
      networkFee: txnFee.asTinybar().toString(), // networkFee
      ourReceiveAddresses: [], // ourReceiveAddresses
      signedTx: '', // signedTx
      otherParams: {
        fromAddress: this.walletLocalData.publicKey,
        toAddress: publicAddress,
        transferTx
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
