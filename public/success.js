(async function(){
  const t=document.getElementById('oTitle'),box=document.getElementById('oBox');
  const id=new URLSearchParams(location.search).get('session_id');
  const add=(tag,cls,txt)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(txt!=null)n.textContent=txt;return n};
  if(!id){t.textContent='No order found';box.appendChild(add('p',null,'If you just paid, check your email for a receipt.'));return}
  try{
    const r=await fetch('/api/order?session_id='+encodeURIComponent(id));const o=await r.json();
    if(!r.ok)throw new Error(o.error||'Order not found');
    const fmt=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:(o.currency||'usd').toUpperCase()}).format((v||0)/100);
    t.textContent=o.paid?('You\'re in'+(o.name?', '+o.name.split(' ')[0]:'')+'!'):'Payment processing';
    const card=add('div','receipt');
    card.appendChild(add('div',null,'Order #'+o.orderNumber));
    if(id.startsWith('cs_test_'))card.appendChild(add('span','tag-test','Test order, no real money charged'));
    o.items.forEach(i=>{const row=add('div','row');row.append(add('span',null,i.name+(o.business?' ('+o.business+')':'')),add('span',null,fmt(i.amount)));card.appendChild(row)});
    if(o.discount){const d=add('div','row');d.append(add('span',null,'Demo credit'),add('span',null,'-'+fmt(o.discount)));card.appendChild(d)}
    const tot=add('div','row tot');tot.append(add('span',null,'Total paid'),add('span',null,fmt(o.total)));card.appendChild(tot);
    box.appendChild(card);
    const h=add('h2',null,'What happens next');box.appendChild(h);
    const ol=add('ol','next');
    const steps=o.plan==='website'
      ?['Check your inbox'+(o.email?' ('+o.email+')':'')+' for your email receipt.','We reach out as soon as possible to collect your logo, photos and text'+(o.care?' and the domain name you want':'')+'.','You review your site, request up to 2 rounds of changes, and we launch it.'].concat(o.care?['Your hosting & care plan renews monthly. Cancel anytime at billing.stripe.com (use the email you paid with) or by emailing us.']:[])
      :['Check your inbox'+(o.email?' ('+o.email+')':'')+' for your email receipt.','We start designing your homepage from the details you sent and email your private preview link as soon as possible.','Love it? Buy the full website and use the code in that email for your $9 credit.'];
    steps.forEach(s=>ol.appendChild(add('li',null,s)));box.appendChild(ol);
  }catch(e){t.textContent='We could not load your order';box.appendChild(add('p',null,'Your payment may still have gone through. Check your email for a receipt or contact us.'))}
})();
