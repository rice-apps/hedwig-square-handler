import { OAuthApi, ObtainTokenRequest } from "square-connect";

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
        const body = new ObtainTokenRequest();

        const {
            merchant_id,
            refresh_token,
            access_token,
        } = await apiInstance.obtainToken({
            ...body,
            client_id: SQUARE_APP_ID,
            client_secret: SQUARE_APP_SECRET,
            grant_type: "authorization_code",
            code: accessCode,
        });

        if (refresh_token) {
            await AUTH.put(merchant_id, { refresh_token, access_token });

            response = new Response("success", { status: 200 });
        } else {
            response = new Response("failure", { status: 404 });
        }
    } else {
        response = new Response("Expected POST", { status: 405 });
    }
    return response;
}
