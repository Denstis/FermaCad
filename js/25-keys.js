/* ==================== KEYBOARD shortcuts ==================== */
'use strict';
/* ================= KEYBOARD ================= */
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(modalOpen){closeModal();return}
  if($('#ctxMenu').style.display==='block'){hideCtx();return}
  if(ptr.mode==='node'&&tx){deserialize(tx);tx=null;ptr.down=false;ptr.mode=null;draggingNode=null;rebuildScene();$('#marquee').style.display='none';return}
  if(paste){paste=null;clearGhost();renderProps();updateHint();return}
  if(chain.a||planePick.length||measPick){chain.a=null;planePick=[];measPick=null;clearGroup(gWork);clearGhost();updateHint();return}
  if(mode==='plan'){exitPlan();return}
  sel.nodes.clear();sel.rods.clear();sel.planes.clear();selectionChanged();return}
 if(modalOpen)return;
 const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return;
 const c=e.code,mod=e.ctrlKey||e.metaKey;
 if(mod){switch(c){case'KeyZ':e.preventDefault();e.shiftKey?redo():undo();return;
   case'KeyY':e.preventDefault();redo();return;
   case'KeyS':e.preventDefault();saveQuick();return;
   case'KeyO':e.preventDefault();savesModal();return;
   case'KeyE':e.preventDefault();exportJSON();return;
   case'KeyC':e.preventDefault();copySelection();return;
   case'KeyV':e.preventDefault();startPaste();return;
   case'KeyG':e.preventDefault();groupModal();return;
   case'KeyD':e.preventDefault();cloneSelection(params.clAxis,params.clStep,1);return}return}
 if(e.key==='F1'){e.preventDefault();helpModal();return}
 const map={KeyV:'select',KeyN:'node',KeyO:'support',KeyL:'plane',KeyM:'measure',
  Digit1:'top',Digit2:'bottom',Digit3:'diag',Digit4:'sdiag',Digit5:'post',Digit6:'column',Digit7:'brace',Digit8:'purlin',Digit9:'custom'};
 if(map[c]){setTool(map[c]);return}
 if(c==='KeyF'){fitAll();return}
 if(c==='KeyH'){if(selCount())hideSelection();return}
 if(c==='Delete'||c==='Backspace'){e.preventDefault();deleteSelection();return}
 if(c==='Enter'&&mode==='plan'){exitPlan();return}});
