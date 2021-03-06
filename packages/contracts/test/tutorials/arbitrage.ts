import { ECSignature, SignedOrder, ZeroEx } from '0x.js';
import { BlockchainLifecycle, devConstants, web3Factory } from '@0xproject/dev-utils';
import { BigNumber } from '@0xproject/utils';
import { Web3Wrapper } from '@0xproject/web3-wrapper';
import * as chai from 'chai';
import ethUtil = require('ethereumjs-util');
import * as Web3 from 'web3';

import { ArbitrageContract } from '../../src/contract_wrappers/generated/arbitrage';
import { EtherDeltaContract } from '../../src/contract_wrappers/generated/ether_delta';
import { ExchangeContract } from '../../src/contract_wrappers/generated/exchange';
import { Balances } from '../../util/balances';
import { constants } from '../../util/constants';
import { crypto } from '../../util/crypto';
import { ExchangeWrapper } from '../../util/exchange_wrapper';
import { OrderFactory } from '../../util/order_factory';
import { BalancesByOwner, ContractName, ExchangeContractErrs } from '../../util/types';
import { chaiSetup } from '../utils/chai_setup';
import { deployer } from '../utils/deployer';
import { provider, web3Wrapper } from '../utils/web3_wrapper';

chaiSetup.configure();
const expect = chai.expect;
const blockchainLifecycle = new BlockchainLifecycle(web3Wrapper);

describe('Arbitrage', () => {
    let coinbase: string;
    let maker: string;
    let edMaker: string;
    let edFrontRunner: string;
    let amountGet: BigNumber;
    let amountGive: BigNumber;
    let makerTokenAmount: BigNumber;
    let takerTokenAmount: BigNumber;
    const feeRecipient = ZeroEx.NULL_ADDRESS;
    const INITIAL_BALANCE = ZeroEx.toBaseUnitAmount(new BigNumber(10000), 18);
    const INITIAL_ALLOWANCE = ZeroEx.toBaseUnitAmount(new BigNumber(10000), 18);

    let weth: Web3.ContractInstance;
    let zrx: Web3.ContractInstance;
    let arbitrage: ArbitrageContract;
    let etherDelta: EtherDeltaContract;

    let signedOrder: SignedOrder;
    let exWrapper: ExchangeWrapper;
    let orderFactory: OrderFactory;

    let zeroEx: ZeroEx;

    // From a bird's eye view - we create two orders.
    // 0x order of 1 ZRX (maker) for 1 WETH (taker)
    // ED order of 2 WETH (tokenGive) for 1 ZRX (tokenGet)
    // And then we do an atomic arbitrage between them which gives us 1 WETH.
    before(async () => {
        const accounts = await web3Wrapper.getAvailableAddressesAsync();
        [coinbase, maker, edMaker, edFrontRunner] = accounts;
        weth = await deployer.deployAsync(ContractName.DummyToken, constants.DUMMY_TOKEN_ARGS);
        zrx = await deployer.deployAsync(ContractName.DummyToken, constants.DUMMY_TOKEN_ARGS);
        const accountLevels = await deployer.deployAsync(ContractName.AccountLevels);
        const edAdminAddress = accounts[0];
        const edMakerFee = 0;
        const edTakerFee = 0;
        const edFeeRebate = 0;
        const etherDeltaInstance = await deployer.deployAsync(ContractName.EtherDelta, [
            edAdminAddress,
            feeRecipient,
            accountLevels.address,
            edMakerFee,
            edTakerFee,
            edFeeRebate,
        ]);
        etherDelta = new EtherDeltaContract(etherDeltaInstance.abi, etherDeltaInstance.address, provider);
        const tokenTransferProxy = await deployer.deployAsync(ContractName.TokenTransferProxy);
        const exchangeInstance = await deployer.deployAsync(ContractName.Exchange, [
            zrx.address,
            tokenTransferProxy.address,
        ]);
        await tokenTransferProxy.addAuthorizedAddress(exchangeInstance.address, { from: accounts[0] });
        zeroEx = new ZeroEx(provider, {
            exchangeContractAddress: exchangeInstance.address,
            networkId: constants.TESTRPC_NETWORK_ID,
        });
        const exchange = new ExchangeContract(exchangeInstance.abi, exchangeInstance.address, provider);
        exWrapper = new ExchangeWrapper(exchange, zeroEx);

        makerTokenAmount = ZeroEx.toBaseUnitAmount(new BigNumber(1), 18);
        takerTokenAmount = makerTokenAmount;
        const defaultOrderParams = {
            exchangeContractAddress: exchange.address,
            maker,
            feeRecipient,
            makerTokenAddress: zrx.address,
            takerTokenAddress: weth.address,
            makerTokenAmount,
            takerTokenAmount,
            makerFee: new BigNumber(0),
            takerFee: new BigNumber(0),
        };
        orderFactory = new OrderFactory(zeroEx, defaultOrderParams);
        const arbitrageInstance = await deployer.deployAsync(ContractName.Arbitrage, [
            exchange.address,
            etherDelta.address,
            tokenTransferProxy.address,
        ]);
        arbitrage = new ArbitrageContract(arbitrageInstance.abi, arbitrageInstance.address, provider);
        // Enable arbitrage and withdrawals of tokens
        await arbitrage.setAllowances.sendTransactionAsync(weth.address, { from: coinbase });
        await arbitrage.setAllowances.sendTransactionAsync(zrx.address, { from: coinbase });

        // Give some tokens to arbitrage contract
        await weth.setBalance(arbitrage.address, takerTokenAmount, { from: coinbase });

        // Fund the maker on exchange side
        await zrx.setBalance(maker, makerTokenAmount, { from: coinbase });
        // Set the allowance for the maker on Exchange side
        await zrx.approve(tokenTransferProxy.address, INITIAL_ALLOWANCE, { from: maker });

        amountGive = ZeroEx.toBaseUnitAmount(new BigNumber(2), 18);
        // Fund the maker on EtherDelta side
        await weth.setBalance(edMaker, amountGive, { from: coinbase });
        // Set the allowance for the maker on EtherDelta side
        await weth.approve(etherDelta.address, INITIAL_ALLOWANCE, { from: edMaker });
        // Deposit maker funds into EtherDelta
        await etherDelta.depositToken.sendTransactionAsync(weth.address, amountGive, { from: edMaker });

        amountGet = makerTokenAmount;
        // Fund the front runner on EtherDelta side
        await zrx.setBalance(edFrontRunner, amountGet, { from: coinbase });
        // Set the allowance for the front-runner on EtherDelta side
        await zrx.approve(etherDelta.address, INITIAL_ALLOWANCE, { from: edFrontRunner });
        // Deposit front runner funds into EtherDelta
        await etherDelta.depositToken.sendTransactionAsync(zrx.address, amountGet, { from: edFrontRunner });
    });
    beforeEach(async () => {
        await blockchainLifecycle.startAsync();
    });
    afterEach(async () => {
        await blockchainLifecycle.revertAsync();
    });
    describe('makeAtomicTrade', () => {
        let addresses: string[];
        let values: BigNumber[];
        let v: number[];
        let r: string[];
        let s: string[];
        let tokenGet: string;
        let tokenGive: string;
        let expires: BigNumber;
        let nonce: BigNumber;
        let edSignature: ECSignature;
        before(async () => {
            signedOrder = await orderFactory.newSignedOrderAsync();
            tokenGet = zrx.address;
            tokenGive = weth.address;
            const blockNumber = await web3Wrapper.getBlockNumberAsync();
            const ED_ORDER_EXPIRATION_IN_BLOCKS = 10;
            expires = new BigNumber(blockNumber + ED_ORDER_EXPIRATION_IN_BLOCKS);
            nonce = new BigNumber(42);
            const edOrderHash = `0x${crypto
                .solSHA256([etherDelta.address, tokenGet, amountGet, tokenGive, amountGive, expires, nonce])
                .toString('hex')}`;
            const shouldAddPersonalMessagePrefix = false;
            edSignature = await zeroEx.signOrderHashAsync(edOrderHash, edMaker, shouldAddPersonalMessagePrefix);
            addresses = [
                signedOrder.maker,
                signedOrder.taker,
                signedOrder.makerTokenAddress,
                signedOrder.takerTokenAddress,
                signedOrder.feeRecipient,
                edMaker,
            ];
            const fillTakerTokenAmount = takerTokenAmount;
            const edFillAmount = makerTokenAmount;
            values = [
                signedOrder.makerTokenAmount,
                signedOrder.takerTokenAmount,
                signedOrder.makerFee,
                signedOrder.takerFee,
                signedOrder.expirationUnixTimestampSec,
                signedOrder.salt,
                fillTakerTokenAmount,
                amountGet,
                amountGive,
                expires,
                nonce,
                edFillAmount,
            ];
            v = [signedOrder.ecSignature.v, edSignature.v];
            r = [signedOrder.ecSignature.r, edSignature.r];
            s = [signedOrder.ecSignature.s, edSignature.s];
        });
        it('should successfully execute the arbitrage if not front-runned', async () => {
            const txHash = await arbitrage.makeAtomicTrade.sendTransactionAsync(addresses, values, v, r, s, {
                from: coinbase,
            });
            const res = await zeroEx.awaitTransactionMinedAsync(txHash);
            const postBalance = await weth.balanceOf(arbitrage.address);
            expect(postBalance).to.be.bignumber.equal(amountGive);
        });
        it('should fail and revert if front-runned', async () => {
            const preBalance = await weth.balanceOf(arbitrage.address);
            // Front-running transaction
            await etherDelta.trade.sendTransactionAsync(
                tokenGet,
                amountGet,
                tokenGive,
                amountGive,
                expires,
                nonce,
                edMaker,
                edSignature.v,
                edSignature.r,
                edSignature.s,
                amountGet,
                { from: edFrontRunner },
            );
            // tslint:disable-next-line:await-promise
            await expect(
                arbitrage.makeAtomicTrade.sendTransactionAsync(addresses, values, v, r, s, { from: coinbase }),
            ).to.be.rejectedWith(constants.REVERT);
            const postBalance = await weth.balanceOf(arbitrage.address);
            expect(preBalance).to.be.bignumber.equal(postBalance);
        });
    });
});
