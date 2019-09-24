/**
 * Created by paul on 8/8/17.
 */
// @flow

import {
  type EdgeCorePluginOptions,
  type EdgeCurrencyEngine,
  type EdgeCurrencyEngineOptions,
  type EdgeCurrencyPlugin,
  type EdgeEncodeUri,
  type EdgeIo,
  type EdgeParsedUri,
  type EdgeWalletInfo
} from 'edge-core-js/types'

import { CurrencyPlugin } from '../common/plugin.js'
import { HederaEngine } from './hederaEngine.js'
import { currencyInfo } from './hederaInfo.js'

import * as hedera from '@hashgraph/sdk'

const URI_PREFIX = 'web+hedera'

export class HederaPlugin extends CurrencyPlugin {
  constructor (io: EdgeIo) {
    super(io, 'hedera', currencyInfo)
  }

  async createPrivateKey (walletType: string): Promise<Object> {
    const type = walletType.replace('wallet:', '')

    if (type === 'hedera') {
      throw new Error('Edge does not support creating new accounts on Hedera at this time.')
    } else {
      throw new Error('InvalidWalletType')
    }
  }

  importPrivateKey (privateKey: string): Promise<{ hederaClient: hedera.Client, hederaPrivateKey: hedera.Ed25519PrivateKey }> {
    const components = privateKey.split(':')

    if (components.length !== 2) {
      throw new Error('invalid private key: ' + privateKey)
    }

    hedera.Ed25519PrivateKey.fromString(components[1])

    return Promise.resolve({ hederaAccount: components[0], hederaPrivateKey: components[1] })
  }

  async derivePublicKey (walletInfo: EdgeWalletInfo): Promise<Object> {
    const type = walletInfo.type.replace('wallet:', '')
    if (type === 'hedera') {
      return { publicKey: walletInfo.keys.hederaKey }
    } else {
      throw new Error('InvalidWalletType')
    }
  }

  async parseUri (uri: string): Promise<EdgeParsedUri> {
    // tests `#` and `#.#.#`
    if (/^\d+(\.\d+\.\d+)?$/.test(uri.trim())) {
      return {
        publicAddress: uri
      }
    } else {
      throw new Error('unsupported wallet URI');
    }
  }

  async encodeUri (obj: EdgeEncodeUri): Promise<string> {
    throw new Error('unimplemented')
    /* const valid = this.checkAddress(obj.publicAddress)
    if (!valid) {
      throw new Error('InvalidPublicAddressError')
    }
    let amount
    if (typeof obj.nativeAmount === 'string') {
      const currencyCode: string = 'XLM'
      const nativeAmount: string = obj.nativeAmount
      const denom = getDenomInfo(currencyInfo, currencyCode)
      if (!denom) {
        throw new Error('InternalErrorInvalidCurrencyCode')
      }
      amount = bns.div(nativeAmount, denom.multiplier, 7)
    }
    if (!amount && !obj.label && !obj.message) {
      return obj.publicAddress
    } else {
      let queryString: string = `destination=${obj.publicAddress}&`
      if (amount) {
        queryString += 'amount=' + amount + '&'
      }
      if (obj.label || obj.message) {
        if (typeof obj.label === 'string') {
          queryString += 'label=' + obj.label + '&'
        }
        if (typeof obj.message === 'string') {
          queryString += 'msg=' + obj.message + '&'
        }
      }
      queryString = queryString.substr(0, queryString.length - 1)

      const serializeObj = {
        scheme: URI_PREFIX,
        path: 'pay',
        query: queryString
      }
      const url = serialize(serializeObj)
      return url
    } */
  }
}

export function makeHederaPlugin (
  opts: EdgeCorePluginOptions
): EdgeCurrencyPlugin {
  console.log('makeHederaPlugin')

  const { io } = opts

  let toolsPromise: Promise<HederaPlugin>

  function makeCurrencyTools (): Promise<HederaPlugin> {
    if (toolsPromise != null) return toolsPromise
    toolsPromise = Promise.resolve(new HederaPlugin(io))
    return toolsPromise
  }

  async function makeCurrencyEngine (
    walletInfo: EdgeWalletInfo,
    opts: EdgeCurrencyEngineOptions
  ): Promise<EdgeCurrencyEngine> {
    console.log('makeHederaPlugin/makeCurrencyEngine')

    const tools = await makeCurrencyTools()
    const currencyEngine = new HederaEngine(tools, walletInfo, opts)

    await currencyEngine.loadEngine(tools, walletInfo, opts)

    // This is just to make sure otherData is Flow type checked
    currencyEngine.otherData = currencyEngine.walletLocalData.otherData
    if (!currencyEngine.otherData.accountSequence) {
      currencyEngine.otherData.accountSequence = 0
    }
    if (!currencyEngine.otherData.lastPagingToken) {
      currencyEngine.otherData.lastPagingToken = '0'
    }

    const out: EdgeCurrencyEngine = currencyEngine
    return out
  }

  return {
    currencyInfo,
    makeCurrencyEngine,
    makeCurrencyTools
  }
}
