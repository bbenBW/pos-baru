import { create } from 'zustand';
import { OfflineProduct, OfflineUnitConversion } from '@/lib/dexie';

export interface CartItem {
    id: string;
    product: OfflineProduct;
    selectedUnit: string;
    unitMultiplier: number;
    qty: number;
    pricePerUnit: number;
    discountPerItem: number; // Rp discount applied to this line
    subtotal: number; // After discount
}

interface CartState {
    items: CartItem[];
    discount: number;
    tax: number;
    paid: number;

    addItem: (product: OfflineProduct, conversions: OfflineUnitConversion[], forced?: { forcedQty?: number; forcedUnit?: string; forcedPrice?: number; forcedMultiplier?: number; forcedDiscount?: number }) => void;
    updateQty: (id: string, qty: number) => void;
    updateUnit: (id: string, newUnit: string, conversions: OfflineUnitConversion[]) => void;
    removeItem: (id: string) => void;
    clearCart: () => void;

    setPayment: (paid: number, discount: number, tax: number) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    discount: 0,
    tax: 0,
    paid: 0,

    addItem: (product, conversions, forced) => {
        set((state) => {
            const unitName = forced?.forcedUnit ?? product.base_unit;
            const multiplier = forced?.forcedMultiplier ?? 1;
            const pricePerUnit = forced?.forcedPrice ?? product.sell_price;
            const qty = forced?.forcedQty ?? 1;
            const discount = forced?.forcedDiscount ?? 0;

            const existingItem = state.items.find(
                i => i.product.id === product.id && i.selectedUnit === unitName
            );

            const cartQtyInBase = state.items
                .filter(i => i.product.id === product.id)
                .reduce((sum, i) => sum + (i.qty / i.unitMultiplier), 0);

            const addedInBase = qty / multiplier;

            if (existingItem) {
                const totalInBase = cartQtyInBase + addedInBase;
                if (totalInBase > product.current_stock) {
                    alert(`⚠️ Stok tidak cukup! Stok tersedia: ${parseFloat(Number(product.current_stock).toFixed(3))} ${product.base_unit}.`);
                    return state;
                }
                const newQty = parseFloat((existingItem.qty + qty).toFixed(3));
                const newGross = newQty * pricePerUnit;
                const newDiscount = existingItem.discountPerItem + discount;
                return {
                    items: state.items.map(item =>
                        item.id === existingItem.id
                            ? {
                                ...item,
                                qty: newQty,
                                discountPerItem: parseFloat(newDiscount.toFixed(3)),
                                subtotal: parseFloat(Math.max(0, newGross - newDiscount).toFixed(3))
                            }
                            : item
                    )
                };
            }

            if (cartQtyInBase + addedInBase > product.current_stock) {
                alert(`⚠️ Stok ${product.name} tidak cukup! Sisa: ${parseFloat(Number(product.current_stock).toFixed(3))} ${product.base_unit}`);
                return state;
            }

            const gross = qty * pricePerUnit;
            const newItem: CartItem = {
                id: crypto.randomUUID(),
                product,
                selectedUnit: unitName,
                unitMultiplier: multiplier,
                qty,
                pricePerUnit,
                discountPerItem: discount,
                subtotal: parseFloat(Math.max(0, gross - discount).toFixed(3)),
            };

            return { items: [...state.items, newItem] };
        });
    },

    updateQty: (id, qty) => {
        set((state) => {
            const item = state.items.find(i => i.id === id);
            if (!item) return state;

            // Validate against stock
            const otherCartQty = state.items
                .filter(i => i.product.id === item.product.id && i.id !== id)
                .reduce((sum, i) => sum + (i.qty / i.unitMultiplier), 0);

            const newQtyInBase = qty / item.unitMultiplier;
            if (otherCartQty + newQtyInBase > item.product.current_stock) {
                alert(`⚠️ Stok tidak cukup! Stok tersedia: ${parseFloat(Number(item.product.current_stock).toFixed(3))} ${item.product.base_unit}`);
                return state;
            }

            return {
                items: state.items.map(i =>
                    i.id === id
                        ? { ...i, qty, subtotal: Number((qty * i.pricePerUnit).toFixed(3)) }
                        : i
                )
            };
        });
    },

    updateUnit: (id, newUnit, conversions) => {
        set((state) => {
            return {
                items: state.items.map(item => {
                    if (item.id !== id) return item;

                    if (newUnit === item.product.base_unit) {
                        return {
                            ...item,
                            selectedUnit: newUnit,
                            unitMultiplier: 1,
                            pricePerUnit: item.product.sell_price,
                            subtotal: Number((item.qty * item.product.sell_price).toFixed(3))
                        };
                    } else {
                        const conversion = conversions.find(c => c.product_id === item.product.id && c.unit_name === newUnit);
                        if (conversion) {
                            const price = conversion.price || Number((item.product.sell_price / conversion.multiplier).toFixed(3));
                            return {
                                ...item,
                                selectedUnit: newUnit,
                                unitMultiplier: conversion.multiplier,
                                pricePerUnit: price,
                                subtotal: Number((item.qty * price).toFixed(3))
                            };
                        }
                        return item;
                    }
                })
            };
        });
    },

    removeItem: (id) => {
        set((state) => ({ items: state.items.filter(item => item.id !== id) }));
    },

    clearCart: () => {
        set({ items: [], discount: 0, tax: 0, paid: 0 });
    },

    setPayment: (paid, discount, tax) => {
        set({ paid, discount, tax });
    }
}));
