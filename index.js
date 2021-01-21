import { Client, Environment } from 'square'
import jwt from 'jsonwebtoken'
import moment from 'moment'

const apiClient = new Client({
  environment: Environment.Sandbox
})

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * Attempts to send body of post request to Square's Obtain Token endpoint
 * @param {Request} request represents request sent by Hedwig Square Plugin client
 * @returns {Promise<Response>} the reponse of this request handler
 */
async function handleRequest (request) {
  let response = new Response('Invalid request type', { status: 405 })

  if (request.method === 'POST') {
    const { accessCode, merchantName } = await request.json()

    if (await newVendorRequest(accessCode, merchantName)) {
      response = new Response('success', { status: 200 })
    } else {
      response = new Response('failure', { status: 404 })
    }
  } else if (request.method === 'GET') {
    try {
      jwt.verify(request.headers.authorization, ACCESS_SECRET) // TODO: bind ACCESS_SECRET to this worker

      const { merchant } = await request.json()

      return new Response(await checkVendorExpiration(merchant), {
        status: 200
      })
    } catch (err) {
      return new Response('Auth error', { status: 403 })
    }
  }

  return response
}

/**
 * Tries to obtain refresh and access tokens with a vendor's access code (only valid for 5 minutes)
 * @param {string} accessCode access code provided to the worker by Square
 * @param {string} merchantName the name of the merchant
 * @returns {Promise<boolean>} indicating whether storing the refresh token succeeded
 */
async function newVendorRequest (accessCode, merchantName) {
  const oauthApi = apiClient.oAuthApi

  try {
    const {
      result: { refreshToken, merchantId, accessToken, expiresAt }
    } = await oauthApi.obtainToken({
      clientId: SQUARE_APP_ID,
      clientSecret: SQUARE_APP_SECRET,
      grantType: 'authorization_code',
      code: accessCode
    })

    await AUTH.put(merchantName, {
      merchantId,
      refreshToken,
      accessToken,
      expiresAt
    }) // TODO: create new KV namespace called AUTH

    return true
  } catch (error) {
    return false
  }
}
/**
 * Gets existing access token or tries to refresh it
 * @param {string} merchantName is the merchant name to get access token.
 * @returns {Promise<string>} OAuth access token for the merchant
 */

async function checkVendorExpiration (merchantName) {
  const { refreshToken, accessToken, expiresAt } = AUTH.get(merchantName)

  if (moment().isAfter(expiresAt)) {
    const oauthApi = apiClient.oAuthApi

    const {
      result: {
        merchantId,
        accessToken: newAccessToken,
        expiresAt: newExpiresAt
      }
    } = await oauthApi.obtainToken({
      clientId: SQUARE_APP_ID,
      clientSecret: SQUARE_APP_SECRET,
      grantType: 'refresh_token',
      refreshToken: refreshToken
    })

    await AUTH.put(merchantName, {
      merchantId,
      refreshToken,
      accessToken: newAccessToken,
      expiresAt: newExpiresAt
    })

    return newAccessToken
  }

  return accessToken
}
