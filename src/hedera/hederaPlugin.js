/**
 * Created by paul on 8/8/17.
 */
// @flow

import * as hedera from '@hashgraph/sdk'
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
    console.log('hederaPlugin/parseUri', uri)

    // tests `#` and `#.#.#`
    if (/^\d+(\.\d+\.\d+)?$/.test(uri.trim())) {
      return {
        publicAddress: uri
      }
    }

    return this.parseUriCommon(currencyInfo, uri, { 'hedera': true }, 'tHBAR')
      .edgeParsedUri
  }

  async encodeUri (obj: EdgeEncodeUri): Promise<string> {
    console.log('hederaPlugin/encodeUri', obj)

    if (!obj.nativeAmount) {
      // don't encode as a URI, just return the public address
      return obj.publicAddress
    }

    return this.encodeUriCommon(obj, 'hedera', obj.nativeAmount)
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

    const { hederaAccount } = walletInfo.keys

    // `publicKey` gets aliased/overloaded as `publicAddress` and is our actual public identifier
    // public keys in Hedera are not used for addressing wallets as they are not unique
    // FIXME: better normalization is implemented in the SDK but not exposed yet
    // https://github.com/hashgraph/hedera-sdk-js/pull/69
    if (/^\d+$/.test(hederaAccount)) {
      // if the account ID is just a single digit, assume account number with shard/realm of 0
      walletInfo.keys.publicKey = `0.0.${walletInfo.keys.hederaAccount}`
    } else {
      walletInfo.keys.publicKey = hederaAccount
    }

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
