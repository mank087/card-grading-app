import { ImageResponse } from 'next/og'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'DCM Grading: card grades, condition reports and Heritage labels'
export default function Image() {
  return new ImageResponse(<div style={{ width:'100%',height:'100%',display:'flex',flexDirection:'column',justifyContent:'center',padding:80,background:'#14233b',color:'white',fontFamily:'sans-serif',borderLeft:'20px solid #9810fa' }}>
    <div style={{display:'flex',fontSize:30,color:'#d8b4fe',marginBottom:32}}>DCM GRADING · DCM OPTIC™</div>
    <div style={{display:'flex',fontSize:72,fontWeight:700,lineHeight:1.1,maxWidth:1000}}>Your cards. A closer look.</div>
    <div style={{display:'flex',fontSize:30,marginTop:32,color:'#dce3ee'}}>Card grades · Condition reports · Heritage labels</div>
    <div style={{display:'flex',fontSize:25,marginTop:52,color:'#d8b4fe'}}>dcmgrading.com</div>
  </div>,size)
}
