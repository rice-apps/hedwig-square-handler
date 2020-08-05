import { OAuthApi, ObtainTokenRequest } from "square-connect";
import jwt from "jsonwebtoken";
import moment from "moment";

let api = new OAuthApi();

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

/**
 * Attempts to send body of post request to Square's Obtain Token endpoint
 * @param {Request} request represents request sent by Hedwig Square Plugin client
 * @returns {Promise<Response>} the reponse of this request handler
 */
async function handleRequest(request) {
    let response = new Response("Invalid request type", { status: 405 });

    if (request.method === "POST") {
        const { accessCode } = await request.json();

        if (await newVendorRequest(accessCode)) {
            response = new Response("success", { status: 200 });
        } else {
            response = new Response("failure", { status: 404 });
        }
    } else if (request.method === "GET") {
        try {
            jwt.verify(request.headers.authorization, ACCESS_SECRET); // TODO: bind ACCESS_SECRET to this worker

            const { merchant } = await request.json();

            return new Response(await checkVendorExpiration(merchant), {
                status: 200,
            });
        } catch (err) {
            return new Response("Auth error", { status: 403 });
        }
    }

    return response;
}

/**
 * Tries to obtain refresh and access tokens with a vendor's access code (only valid for 5 minutes)
 * @param {string} accessCode access code provided to the worker by Square
 * @returns {Promise<boolean>} indicating whether storing the refresh token succeeded
 */
async function newVendorRequest(accessCode) {
    const {
        merchant_id,
        refresh_token,
        access_token,
        expires_at,
    } = await api.obtainToken({
        ...new ObtainTokenRequest(),
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        grant_type: "authorization_code",
        code: accessCode,
    });

    let isSuccess = false;

    if (refresh_token) {
        await AUTH.put(merchant_id, {
            refresh_token,
            access_token,
            expires_at,
        }); // TODO: create new KV namespace called AUTH

        isSuccess = true;
    }

    return isSuccess;
}
/**
 * Gets existing access token or tries to refresh it
 * @param {string} merchant is the merchant id to get access token.
 * @returns {Promise<string>} OAuth access token for the merchant
 */

async function checkVendorExpiration(merchant) {
    const { refresh_token, access_token, expires_at } = await AUTH.get(
        merchant,
    );

    if (moment().isAfter(expires_at)) {
        const {
            merchant_id,
            access_token: new_access_token,
            refresh_token: same_refresh_token,
            expires_at: new_expires_at,
        } = await api.obtainToken({
            ...new ObtainTokenRequest(),
            grant_type: "refresh_token",
            refresh_token,
        });

        await AUTH.delete(merchant_id);
        await AUTH.put(merchant_id, {
            same_refresh_token,
            new_access_token,
            expires_at: new_expires_at,
        });

        return new_access_token;
    }

    return access_token;
}
