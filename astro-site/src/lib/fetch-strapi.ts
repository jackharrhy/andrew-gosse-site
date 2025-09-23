const strapiUrl = import.meta.env.STRAPI_URL;

const fetchFromStrapi = async (path: string) => {
  const url = `${strapiUrl}/api/${path}?populate=*`;
  const response = await fetch(url);
  const { data } = await response.json();
  return data;
};

export async function fetchHomepage() {
  return fetchFromStrapi("homepage");
}
