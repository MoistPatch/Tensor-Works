(function () {
  'use strict';

  async function gqlFetch(query, variables) {
    const { domain, storefrontToken } = window.TW.shopify;
    const endpoint = `https://${domain}/api/2024-01/graphql.json`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`Shopify API HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  async function fetchProducts(options) {
    options = options || {};
    if (!window.TW.shopify.configured) return window.TW.products;
    try {
      const query = `
        query fetchProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            nodes {
              handle
              title
              description
              tags
              priceRange { minVariantPrice { amount currencyCode } }
              variants(first: 1) { nodes { id } }
              images(first: 1) { nodes { url altText } }
              metafields(identifiers: [{namespace:"custom",key:"sku"},{namespace:"custom",key:"category"}]) {
                key value
              }
            }
          }
        }
      `;
      const data = await gqlFetch(query, { first: options.first || 50, after: options.after || null });
      return data.products.nodes;
    } catch (err) {
      if (window.TW._warned !== 'products') {
        console.warn('[TensorWorks] Shopify fetchProducts failed, using static data:', err.message);
        window.TW._warned = 'products';
      }
      return window.TW.products;
    }
  }

  async function fetchProduct(handle) {
    if (!window.TW.shopify.configured) {
      return window.TW.products.find(function (p) { return p.handle === handle; }) || null;
    }
    try {
      const query = `
        query fetchProduct($handle: String!) {
          product(handle: $handle) {
            handle
            title
            description
            tags
            variants(first: 10) {
              nodes { id title priceV2 { amount currencyCode } availableForSale }
            }
            images(first: 5) { nodes { url altText } }
            metafields(identifiers: [{namespace:"custom",key:"sku"},{namespace:"custom",key:"category"}]) {
              key value
            }
          }
        }
      `;
      const data = await gqlFetch(query, { handle });
      return data.product;
    } catch (err) {
      if (window.TW._warned !== 'product') {
        console.warn('[TensorWorks] Shopify fetchProduct failed, using static data:', err.message);
        window.TW._warned = 'product';
      }
      return window.TW.products.find(function (p) { return p.handle === handle; }) || null;
    }
  }

  async function cartCreate(lines) {
    if (!window.TW.shopify.configured) return { cartId: null, checkoutUrl: null };
    const query = `
      mutation cartCreate($lines: [CartLineInput!]!) {
        cartCreate(input: { lines: $lines }) {
          cart {
            id
            checkoutUrl
            lines(first: 50) {
              nodes {
                id
                quantity
                merchandise {
                  ... on ProductVariant {
                    id
                    title
                    product { title handle }
                    priceV2 { amount currencyCode }
                  }
                }
              }
            }
          }
          userErrors { field message }
        }
      }
    `;
    const data = await gqlFetch(query, { lines });
    const errors = data.cartCreate.userErrors;
    if (errors && errors.length) throw new Error(errors[0].message);
    const cart = data.cartCreate.cart;
    return { cartId: cart.id, checkoutUrl: cart.checkoutUrl, lines: cart.lines.nodes };
  }

  async function cartLinesAdd(cartId, lines) {
    if (!window.TW.shopify.configured) return null;
    const query = `
      mutation cartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
        cartLinesAdd(cartId: $cartId, lines: $lines) {
          cart {
            id checkoutUrl
            lines(first: 50) { nodes { id quantity merchandise { ... on ProductVariant { id title priceV2 { amount currencyCode } } } } }
          }
          userErrors { field message }
        }
      }
    `;
    const data = await gqlFetch(query, { cartId, lines });
    return data.cartLinesAdd.cart;
  }

  async function cartLinesUpdate(cartId, lines) {
    if (!window.TW.shopify.configured) return null;
    const query = `
      mutation cartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) {
        cartLinesUpdate(cartId: $cartId, lines: $lines) {
          cart {
            id checkoutUrl
            lines(first: 50) { nodes { id quantity merchandise { ... on ProductVariant { id title priceV2 { amount currencyCode } } } } }
          }
          userErrors { field message }
        }
      }
    `;
    const data = await gqlFetch(query, { cartId, lines });
    return data.cartLinesUpdate.cart;
  }

  async function cartLinesRemove(cartId, lineIds) {
    if (!window.TW.shopify.configured) return null;
    const query = `
      mutation cartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
        cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
          cart {
            id checkoutUrl
            lines(first: 50) { nodes { id quantity merchandise { ... on ProductVariant { id title priceV2 { amount currencyCode } } } } }
          }
          userErrors { field message }
        }
      }
    `;
    const data = await gqlFetch(query, { cartId, lineIds });
    return data.cartLinesRemove.cart;
  }

  async function fetchCart(cartId) {
    if (!window.TW.shopify.configured || !cartId) return null;
    const query = `
      query fetchCart($cartId: ID!) {
        cart(id: $cartId) {
          id checkoutUrl
          lines(first: 50) {
            nodes {
              id quantity
              merchandise {
                ... on ProductVariant {
                  id title
                  product { title handle }
                  priceV2 { amount currencyCode }
                }
              }
            }
          }
        }
      }
    `;
    try {
      const data = await gqlFetch(query, { cartId });
      return data.cart;
    } catch (err) {
      console.warn('[TensorWorks] fetchCart failed:', err.message);
      return null;
    }
  }

  window.ShopifyAPI = {
    gqlFetch,
    fetchProducts,
    fetchProduct,
    cartCreate,
    cartLinesAdd,
    cartLinesUpdate,
    cartLinesRemove,
    fetchCart,
  };
})();
