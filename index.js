import { OAuthApi, ObtainTokenRequest } from "square-connect";
import jwt from "jsonwebtoken";
import moment from "moment";

let apiInstance = new OAuthApi();

addEventListener("fetch", event => {
    event.respondWith(handleRequest(event.request));
});

/**
 * Attempts to send body of post request to Square's Obtain Token endpoint
 * @param {Request} request represents request sent by Hedwig Square Plugin client
 */
async function handleRequest(request) {
    let response;
    if (request.method === "POST") {
        const { accessCode } = await request.json();

        const {
            merchant_id,
            refresh_token,
            access_token,
            expires_at,
        } = await apiInstance.obtainToken({
            ...new ObtainTokenRequest(),
            client_id: SQUARE_APP_ID,
            client_secret: SQUARE_APP_SECRET,
            grant_type: "authorization_code",
            code: accessCode,
        });

        if (refresh_token) {
            await AUTH.put(merchant_id, {
                refresh_token,
                access_token,
                expires_at,
            }); // TODO: create new KV namespace called AUTH

            response = new Response("success", { status: 200 });
        } else {
            response = new Response("failure", { status: 404 });
        }
    } else if (request.method === "GET") {
        try {
            jwt.verify(request.headers.authorization, ACCESS_SECRET); // TODO: bind ACCESS_SECRET to this worker

            const { merchant } = await request.json();

            const { refresh_token, expires_at } = await AUTH.get(merchant);

            if (moment().isAfter(expires_at)) {
                const {
                    merchant_id,
                    access_token,
                    refresh_token: same_refresh_token,
                    expires_at: new_expires_at,
                } = await apiInstance.obtainToken({
                    ...new ObtainTokenRequest(),
                    grant_type: "refresh_token",
                    refresh_token,
                });

                await AUTH.delete(merchant_id);
                await AUTH.put(merchant_id, {
                    same_refresh_token,
                    access_token,
                    expires_at: new_expires_at,
                });
            }

            return new Response(await AUTH.get(merchant).access_token, {
                status: 200,
            });
        } catch (err) {
            return new Response("Auth error", { status: 403 });
        }
    } else {
        response = new Response("Expected POST", { status: 405 });
    }
    return response;
}
