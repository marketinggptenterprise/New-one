import { facebookFetch, json } from "./_facebook.js";

export default async function handler(req, res) {
  try {
    const data = await facebookFetch(req, "/me/accounts", {
      fields: "id,name,access_token,picture{url}"
    });
    const pages = (data.data || []).map((page) => ({
      id: page.id,
      name: page.name,
      accessToken: page.access_token,
      picture: page.picture?.data?.url || ""
    }));
    json(res, 200, { pages });
  } catch (error) {
    json(res, error.status || 500, { error: error.message, details: error.details });
  }
}
