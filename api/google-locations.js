import { googleFetch, json } from "./_google.js";

function formatAddress(address) {
  if (!address) return "";
  return [address.addressLines?.join(" "), address.locality, address.administrativeArea, address.postalCode]
    .filter(Boolean)
    .join(", ");
}

export default async function handler(req, res) {
  try {
    const accountsData = await googleFetch(req, res, "https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    const accounts = accountsData.accounts || [];
    const locations = [];

    for (const account of accounts) {
      let pageToken = "";
      do {
        const params = new URLSearchParams({
          readMask: "name,title,storefrontAddress,metadata",
          pageSize: "100"
        });
        if (pageToken) params.set("pageToken", pageToken);

        const url = `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations?${params.toString()}`;
        const data = await googleFetch(req, res, url);

        for (const location of data.locations || []) {
          locations.push({
            name: location.name,
            title: location.title,
            address: formatAddress(location.storefrontAddress),
            accountName: account.name
          });
        }

        pageToken = data.nextPageToken || "";
      } while (pageToken);
    }

    json(res, 200, { locations });
  } catch (error) {
    json(res, error.status || 500, { error: error.message });
  }
}
