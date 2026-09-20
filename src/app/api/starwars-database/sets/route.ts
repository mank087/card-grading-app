import { NextResponse } from 'next/server';
/** Retired: deliberately performs no catalog/database access. */
export async function GET() {
  return NextResponse.json({error:'Star Wars catalog retired. Grade cards under Other / Star Wars.',retired:true},
    {status:410,headers:{'cache-control':'no-store'}});
}
