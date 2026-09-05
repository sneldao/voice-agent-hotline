import { ethers } from 'ethers';
import { AERODROME_CL_FACTORY_NEWEST, AERODROME_MIXED_QUOTER, BASE_RPC_URL } from '../base-chain';
import type { QuoteReader } from './quotes';

const tokenAbi = ['function decimals() view returns (uint8)', 'function multiplier() view returns (uint256)'];
const poolAbi = [
  'function token0() view returns (address)', 'function token1() view returns (address)',
  'function factory() view returns (address)', 'function tickSpacing() view returns (int24)',
  'function liquidity() view returns (uint128)',
];
const quoterAbi = [
  'function factory() view returns (address)',
  'function quoteExactInput(bytes path,uint256 amountIn) returns (uint256 amountOut,uint160[] prices,uint32[] ticks,uint256 gasEstimate)',
];
const feedAbi = [
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId,int256 answer,uint256 startedAt,uint256 updatedAt,uint80 answeredInRound)',
];

export function createAerodromeReader(): QuoteReader {
  return { async read(stock, pair, side, amount) {
    const request = new ethers.FetchRequest(BASE_RPC_URL);
    request.timeout = 8000;
    const provider = new ethers.JsonRpcProvider(request, undefined, { batchMaxCount: 1 });
    try {
      const chainId = Number(BigInt(await provider.send('eth_chainId', [])));
      if (chainId !== 8453) throw new Error('wrong_chain');
      const block = await provider.getBlock('latest');
      if (!block || Date.now() - block.timestamp * 1000 > 60000) throw new Error('stale_block');
      const at = { blockTag: block.number };
      const pool = new ethers.Contract(pair.poolAddress, poolAbi, provider);
      const token = new ethers.Contract(stock.contractAddress, tokenAbi, provider);
      const usdc = new ethers.Contract(pair.quoteToken, tokenAbi, provider);
      const quoter = new ethers.Contract(AERODROME_MIXED_QUOTER, quoterAbi, provider);
      const factoryContract = new ethers.Contract(AERODROME_CL_FACTORY_NEWEST, ['function getPool(address,address,int24) view returns (address)'], provider);
      const values = await Promise.all([
        pool.token0(at), pool.token1(at), pool.factory(at), pool.tickSpacing(at), pool.liquidity(at),
        token.decimals(at), token.multiplier(at), usdc.decimals(at), quoter.factory(at),
        factoryContract.getPool(stock.contractAddress, pair.quoteToken, pair.tickSpacing, at),
      ]);
      const [token0, token1, factory, spacing, liquidity, tokenDecimals, multiplier, quoteDecimals, quoterFactory, resolvedPool] = values;
      const expectedTokens = [stock.contractAddress, pair.quoteToken].map(a => a.toLowerCase()).sort();
      if ([String(token0), String(token1)].map(a => a.toLowerCase()).sort().join() !== expectedTokens.join() || String(resolvedPool).toLowerCase() !== pair.poolAddress.toLowerCase() || String(factory).toLowerCase() !== AERODROME_CL_FACTORY_NEWEST.toLowerCase() || String(quoterFactory).toLowerCase() !== AERODROME_CL_FACTORY_NEWEST.toLowerCase() || Number(spacing) !== pair.tickSpacing || Number(tokenDecimals) !== stock.decimals || Number(quoteDecimals) !== 6) throw new Error('route_mismatch');
      const input = side === 'buy' ? pair.quoteToken : stock.contractAddress;
      const output = side === 'buy' ? stock.contractAddress : pair.quoteToken;
      const path = ethers.solidityPacked(['address', 'int24', 'address'], [input, pair.tickSpacing | pair.clFactoryBitmask, output]);
      const [amountOut] = await quoter.quoteExactInput.staticCall(path, amount, at);
      let reference = null;
      try {
        const feed = new ethers.Contract(stock.chainlinkFeed, feedAbi, provider);
        const [round, decimals] = await Promise.all([feed.latestRoundData(at), feed.decimals(at)]);
        reference = { answer: BigInt(round.answer), decimals: Number(decimals), updatedAt: Number(round.updatedAt) };
      } catch {}
      return {
        chainId, blockNumber: block.number, blockTimestamp: block.timestamp,
        token0: String(token0), token1: String(token1), factory: String(factory), quoterFactory: String(quoterFactory),
        resolvedPool: String(resolvedPool), tickSpacing: Number(spacing), tokenDecimals: Number(tokenDecimals),
        quoteDecimals: Number(quoteDecimals), multiplier: BigInt(multiplier), liquidity: BigInt(liquidity),
        amountOut: BigInt(amountOut), reference,
      };
    } finally { provider.destroy(); }
  } };
}
