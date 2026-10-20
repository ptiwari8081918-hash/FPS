const Booking = require('../models/Booking');
const Slot    = require('../models/Slot');
const Shop    = require('../models/Shop');
const { getISTDateString } = require('../utils/ist');

exports.getDashboard = async (req,res) => {
  try {
    const {shopId}=req.params;
    const today=getISTDateString(); // IST-aware today
    const now=new Date();
    const [shop,totalB,todayB,missed,allSlots,todaySlots,allBookings]=await Promise.all([
      Shop.findOne({shopId}),
      Booking.countDocuments({shopId}),
      Booking.countDocuments({shopId,slotDate:today}),
      Booking.countDocuments({shopId,status:'missed'}),
      Slot.find({shopId}).sort({startTime:-1}).limit(500),
      Slot.find({shopId,date:today}),
      Booking.find({shopId}).select('slotTime slotDate').lean()
    ]);
    const active=allSlots.filter(s=>!s.isBreak);
    const totalCap=active.reduce((a,s)=>a+s.capacity,0);
    const totalBooked=active.reduce((a,s)=>a+s.bookedCount,0);
    const utilizationRate=totalCap>0?Math.round((totalBooked/totalCap)*100):0;
    const hourlyData=Array.from({length:24},(_,i)=>({hour:i,count:0,label:`${String(i).padStart(2,'0')}:00`}));
    allBookings.forEach(b=>{
      try{
        const parts=(b.slotTime||'').split(' ');
        const [hm,period]=parts;
        let h=parseInt(hm.split(':')[0]);
        if(period==='PM'&&h!==12) h+=12;
        if(period==='AM'&&h===12) h=0;
        if(h>=0&&h<24) hourlyData[h].count++;
      }catch(_){}
    });
    const weekTrend=[];
    for(let i=6;i>=0;i--){
      const d=new Date(); d.setDate(d.getDate()-i);
      const ds=d.toISOString().slice(0,10);
      weekTrend.push({date:ds,count:allBookings.filter(b=>b.slotDate===ds).length});
    }
    const nowStr=now.toISOString();
    const activeNow=todaySlots.filter(s=>s.status==='active'&&!s.isBreak&&new Date(s.startTime)<=now&&new Date(s.endTime)>=now).length;
    const remaining=todaySlots.filter(s=>s.status==='active'&&!s.isBreak&&new Date(s.startTime)>now).length;
    res.json({success:true,analytics:{
      totalBookings:totalB,todayBookings:todayB,missedBookings:missed,
      utilizationRate,totalSlots:active.length,activeNow,remainingSlots:remaining,
      hourlyData,weekTrend,snapshot:shop?.apiSnapshot||{}
    }});
  } catch(err){console.error(err);res.status(500).json({success:false,message:'Analytics failed'});}
};
