(() => {
  const form=document.querySelector('#support-form'),button=form.querySelector('button[type=submit]'),feedback=document.querySelector('#support-feedback');
  const receipt=document.querySelector('#support-receipt'),reference=document.querySelector('#support-reference');
  let requestId=crypto.randomUUID(),lastPayload='';
  button.disabled=false;
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!form.reportValidity())return;
    const values=Object.fromEntries(new FormData(form)),payload=JSON.stringify(values);
    if(lastPayload&&payload!==lastPayload)requestId=crypto.randomUUID();
    lastPayload=payload;button.disabled=true;feedback.textContent='Sending your report…';
    try{
      const response=await fetch('/api/support',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify({...values,request_id:requestId})});
      const result=await response.json();if(!response.ok||!result.ok)throw Error(result.message||'The report was not sent. Please try again.');
      form.hidden=true;feedback.textContent='Your report has been received privately by the development team.';reference.textContent=result.reference;receipt.hidden=false;receipt.focus();
    }catch(error){feedback.textContent=error.message||'The report was not sent. Your text is still in the form.';}
    finally{button.disabled=false;}
  });
  document.querySelector('#support-new').addEventListener('click',()=>{form.reset();requestId=crypto.randomUUID();lastPayload='';receipt.hidden=true;form.hidden=false;feedback.textContent='';document.querySelector('#support-subject').focus();});
})();
