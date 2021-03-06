import { BlockParamLiteral } from '@0xproject/types';
import { BigNumber } from '@0xproject/utils';

import { BalanceAndProxyAllowanceFetcher } from '../abstract/balance_and_proxy_allowance_fetcher';
import { TokenWrapper } from '../contract_wrappers/token_wrapper';

export class SimpleBalanceAndProxyAllowanceFetcher implements BalanceAndProxyAllowanceFetcher {
    private _tokenWrapper: TokenWrapper;
    private _defaultBlock: BlockParamLiteral;
    constructor(token: TokenWrapper, defaultBlock: BlockParamLiteral) {
        this._tokenWrapper = token;
        this._defaultBlock = defaultBlock;
    }
    public async getBalanceAsync(tokenAddress: string, userAddress: string): Promise<BigNumber> {
        const methodOpts = {
            defaultBlock: this._defaultBlock,
        };
        const balance = this._tokenWrapper.getBalanceAsync(tokenAddress, userAddress, methodOpts);
        return balance;
    }
    public async getProxyAllowanceAsync(tokenAddress: string, userAddress: string): Promise<BigNumber> {
        const methodOpts = {
            defaultBlock: this._defaultBlock,
        };
        const proxyAllowance = this._tokenWrapper.getProxyAllowanceAsync(tokenAddress, userAddress, methodOpts);
        return proxyAllowance;
    }
}
