/** Mega Gengar ex #284/217, serial 475225; front and back reviewed. No database featured flags are changed. */
export const MARKETING_POKEMON_CARD_ID = '3ed7f3fd-c875-4090-995d-2baa8564b55b'

// Separate public card selections for informational pages; front/back photos reviewed.
export const LEARNING_CARD_IDS = {
  'why-dcm': ['8c37d5b4-fbbf-4129-9cb0-580532fba4a4', '5a04d45d-9bdc-4b60-a9bd-230bba2b6d1f', '4b4de275-88f7-4846-9542-0064cee74d2d'],
  'grading-standard': ['446fd0f1-f6d9-4a9e-b697-546f41136923', '695dcc67-1249-4d0f-b1cd-8037867c49c6', '33c7a5f7-cf8b-4b08-a622-5a20e6311acb'],
  'reports-and-labels': ['da16290f-079c-4628-a29f-79b3bc3d6952', '5b9097bc-6101-4885-9565-8f3d8f5177df', '34a413c9-61cd-46f9-9e77-36c568561866'],
  'get-started': ['644abec1-bdf6-44c6-956b-772279462dfb', '6a130b4e-3915-47af-9e3d-df1575bbf994', '0ae08f95-cae6-4709-b9e6-f69fc51a23a7'],
  'ai-card-grading': ['af8833dc-5aee-409a-afd8-f57ccf457ec4', '710bd6f8-a4e3-4f9f-96fb-09979b0617c1', '4239dbe8-0da9-405e-8f23-8724c87c8e20'],
} as const

/** Reviewed homepage selection; keep the API query to the five displayed cards. */
export const HOME_SHOWCASE_IDS = [
  MARKETING_POKEMON_CARD_ID,
  '998bffa2-8d30-4b66-b2c9-14c356e2739a',
  'bf081123-479b-495e-8781-d4cc2389d14a',
  '9876e36e-41cf-4a7f-99d7-7bb29955487f',
  '65fda45f-17b3-4437-95ef-ef130a91edc5',
] as const
