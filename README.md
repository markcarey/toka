![Toka](https://toka.lol/images/toka64.png)
# Toka

## Mint Zora NFTs completely onframe with $DEGEN or ETH
Toka Frames enable minting of any Zora NFT by sending a transaction from a Frame, without the need to visit another website or dapp to do the minting. And collectors can use Toka Frames to "mint with $DEGEN" instead of ETH.
![Toka Mint Frame](https://toka.lol/images/toka-mint-dog.jpg)

## Video Demo

https://youtu.be/6PUztLiMqIA

## Try it Now
The [/toka](https://warpcast.com/~/channel/toka) channel in Warpcast provides multiple Toka Mint Frames that you can try today:

https://warpcast.com/~/channel/toka

You can also take any zora.co mint URL and replace `zora.co` with `toka.lol`.  For example:
https://zora.co/collect/base:0x82e30a63bccde3724877878a30c4977b52348198/1
becomes
https://toka.lol/collect/base:0x82e30a63bccde3724877878a30c4977b52348198/1

To try an "admin frame" replace `collect` with `admin` in the URL, but note that you must be the owner/creator of the collection or the transactions will fail. Only authorized wallets can enable a collection.

### Zora NFTs as Transaction Frames
One way to cast Toka Frames, is to take any Zora mint URL and replace `zora.co` with `toka.lol` and cast it. Toka grabs the NFT contract address and tokenId from the Frame URL and uses them ti fetch the metadata and image for the NFT, as well as pricing information. After hitting the inital `Mint` button, the user is presented with options to pay with ETH or $DEGEN. When choosing $DEGEN, first the user send an `approve()` transaction to enable the Toka contract to take the $DEGEN minting fee and then a `mintWithDegen()` transaction to mint the NFT via the Toka minter contract. If then user chooses to mint with ETH, there is one transaction from the frame directly to the Zora contract -- this is essentially the same transaction that users send when minting from the Zora dapp, but with Toka you can mint completely onframe.

### Two ways to Mint with $DEGEN
- The first way to mint with $DEGEN is when creators explicitly enable their collections for "mint with $DEGEN". To do this they first send a transaction to authorize the Toka minter contract to mint tokens from the collection. Then creators can choose a price in $DEGEN, if desired. Minting happens via the Toka contract, which enforces the mint fee + the price, and then _airdrops_ the NFT to the minter. As such there is no ETH sent to the Zora contract and this no Zora "rewards". But there is a Toka mint fee of 420 $DEGEN -- of that, and rewards of 351 $DEGEN for each NFT minted go immediately to the creator (no need claim).
![Toka Admin](https://toka.lol/images/enable-mwd.jpg)

- But you can still "mint with $DEGEN" even if the creator has not (yet!) enabled "Mint with $DEGEN". This permissionless $DEGEN minting is the same from the minter perspective, they approve then mint via the Toka contract. But since the Toka contract has not been authorized to airdrop NFTs to minters, it does the most degen thing it can. It takes the $DEGEN mint fee and swaps it for ETH via Uniswap v3, and then sends the Zora minting fee along with a standard `mintWithRewards()` call to the Zora contract. As such, the Zora mint _is_ paid in ETH and Zora rewards in ETH apply the same way as if the minter has minted from the Zora dapp.
![Mint with DEGEN](https://toka.lol/images/toka-approve-degen.jpg)
![Swap](https://toka.lol/images/mwd-swap.jpg)

### Frames
- Mint Frames as mentioned above, enable onframe minting via $DEGEN or ETH
- Admin Frames can be used by Creators to opt-in to "mint with $DEGEN" and set prices in $DEGEN.
- Curation Frames showcase the most popular mint frames over the last 24 hours, powered by Pinata Analytics (coming soon)

## How Toka was Built
For each Toka minting Frame, Toka server functions fetch details from the NFT contracts including metadata (usually stored on IPFS), creator configured pricing, and ownership/permissions. With these details, each minting Frame is built with the NFT image and buttons to mint with $DEGEN or ETH. Minting with ETH is similar to minting from the Zora dapp, and Toka returns the transaction data so the user can mint directly against the Zora contract without ever leaving the Frame.

Zora NFTs can be either ERC721 or ERC1155 and this adds complexity due to the different functions that need to be called to fetch relevant data and initiate minting.

### Toka Contracts on Base
Whether minting with $DEGEN has been enabled for an NFT ... or not ... minting is done via Toka's contracts that have been deployed to Base:

- `TokaMint1155.sol` - This contract handles minting with $DEGEN for Zora ERC1155 contracts. It enables creators to set a price in $DEGEN for each of the NFTs and enables minters to pay the mint fee in $DEGEN in exchange for the NFT. It also checks that the "minting rules" set by the creator are enforced, such as time-limited minting windows. [Base](https://basescan.org/address/0xe215c656e2208482bf4800624c6994d0cf69df28)
- `TokaMin721.sol` - This contract performs the same functions for Zora ERC721 contracts. These contracts have a different interface, necessitating key differences to interact with the contracts. [Base](https://basescan.org/address/0xc0405a27cf007c885c5179889883ab4ef0636a07)
- `Swapper.sol` - This contract gets called by the above Minting contracts when a creator has not (yet!) explicitly enabled "mint with $DEGEN". The Swapper contract has one purpose, to swap $DEGEN for ETH via Uninswap v3 on Base. Since the Zora mint fee must be paid in ETH, do the $DEGEN-to-ETH swap behind the scenes enables the minter to pay in $DEGEN and still get the NFT. Once the swap is complete, the Minter contract call the respective `mintWithRewards()` function on the Zora contracr while send the mint fee (typically 0.000777 ETH) as `value` in the function call. The minter is unaware of the swap -- they just pay a mint fee in $DEGEN and receive an NFT. Without ever leaving the Toka Frame! [Base](https://basescan.org/address/0x1caf4794cd36cf4ce6f50cd6e23b2af5bb639321)

### Frame Server(less)
All Farcaster Frames require a Frame Server to handle POST request from the Frame client. Toka uses Google Firebase (serverless) Functions for the purpose. The primary `api` function serves as  handler for both intial frames -- which are dynamic in nature, different for each NFT -- and for handling the button handlers for both the Mint and Admin frames. The Firebase functions are coded in NodeJS.

Two Google Cloud "pub/sub" functions are used to process certain things in the background:
- each Frame interaction is logged to Pinata Frame Analytics, pubsub is used to quicly hand off the logging task to background function [#](/firebase/functions/toka/index.js#L47)
- a Neynar webhook sends a POST every time a zora.com/collect/ URL is casted. These too are passed off from the api endpoint to background process that parses the new casts and then send outs Toka Frames from the @toka account to the /toka channel with newly discovered NFTs that can then be minted with $DEGEN or ETH. [#](/main/firebase/functions/toka/index.js#L65)

## Sponsor Tech Used
- `Base` - Toka contracts have been deployed to Base and currently only supports Toka Frame for Zora NFTs on Base. [#](#toka-contracts-on-base)
- `Neynar` - Frame validation is performed by Neynar's api, as well as webhooks for new casts, and several other endpoints, such as looking up a user account for the owner/creator of an NFT contracts [#](/firebase/functions/toka/util.js#L178)
- `Pinata` - Toka logs all Frame interaction to Pinata Frame Analytics. The analytics data will then be used to powered Curation frames that feature the most popular Toka minting frames ... curated into a single Frame you can "scroll" through. (coming soon) [#](/firebase/functions/toka/index.js#L47)

## Next Steps
- Curation and discovery tools powered by Toka mninting frames
- NFT collection and publishing via casts and/or Frames, without the need to leave Farcaster to create and deploy NFTs
- Expansion beyond Zora NFTs to other platforms
- Toka's own NFT factory for deploying NFT collections
- Open-Frames / XMTP support

## Contact
- Farcaster: @markcarey
- Discord: @markcarey
- Telegram: @markcarey
- Twitter: @mthacks




