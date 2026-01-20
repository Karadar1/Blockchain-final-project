module sui_ibt::ibt;

use std::string::String;
use sui::coin::{Self, Coin, TreasuryCap};
use sui::transfer;
use sui::tx_context::{sender};
use sui::event;

public struct IBT has drop {}

public struct BridgeBurnEvent has copy, drop {
    amount: u64,
    sender: address,
    recipient_eth: String,
}

#[allow(deprecated_usage)]
fun init(witness: IBT, ctx: &mut TxContext) {
    let (treasury, metadata) = coin::create_currency(
        witness, 
        9, 
        b"IBT", 
        b"Inter-Blockchain Token", 
        b"Token for bridging", 
        option::none(), 
        ctx
    );
    
    transfer::public_freeze_object(metadata);
    transfer::public_transfer(treasury, sender(ctx))
}

public fun mint(
    treasury_cap: &mut TreasuryCap<IBT>, 
    amount: u64, 
    recipient: address, 
    ctx: &mut TxContext
) {
    let coin = coin::mint(treasury_cap, amount, ctx);
    transfer::public_transfer(coin, recipient)
}

public fun bridge_burn(coin: Coin<IBT>, recipient_eth: String, ctx: &mut TxContext) {
    let amount = coin::value(&coin);
    let sender = sender(ctx);
    
    transfer::public_transfer(coin, @0x0);

    event::emit(BridgeBurnEvent {
        amount,
        sender,
        recipient_eth
    });
}