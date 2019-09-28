/* global */
// @flow

import { hbarUnitSymbols } from '@hashgraph/sdk'
import { type EdgeCurrencyInfo } from 'edge-core-js/types'
// import { imageServerUrl } from '../common/utils'
import { type HederaSettings } from './hederaTypes.js'

const otherSettings: HederaSettings = {
  hederaNodes: {
    // grpc-web uses fetch() and so should be compatible with React Native
    'https://grpc-web.testnet.myhbarwallet.com': '0.0.3'
  }
}

const defaultSettings: any = {
  otherSettings
}

export const currencyInfo: EdgeCurrencyInfo = {
  // Basic currency information:
  currencyCode: 'HBAR',
  displayName: 'Hedera HBAR',
  pluginName: 'hedera',
  walletType: 'wallet:hedera',

  defaultSettings,

  /* TODO
  addressExplorer: '<TBD>',
  transactionExplorer: '<TBD>',
  */

  denominations: [
    // An array of Objects of the possible denominations for this currency
    // other denominations are specified but these are the most common
    {
      name: 'HBAR',
      multiplier: '100000000', // 100,000,000
      symbol: hbarUnitSymbols.hbar
    },
    {
      name: 'tHBAR',
      multiplier: '1',
      symbol: hbarUnitSymbols.tinybar
    }
  ],
  // FIXME: upload to EDGE's image server
  symbolImage: `http://10.0.2.2:8000/hedera-white.png`,
  symbolImageDarkMono: `http://10.0.2.2:8000/hedera-black.png`,
  metaTokens: []
}
