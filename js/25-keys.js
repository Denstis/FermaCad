/* ==================== KEYBOARD shortcuts ==================== */
'use strict';
/* ================= KEYBOARD ================= */
/* Esc is a universal cancel: modal -> ctx menu -> node drag -> paste -> tool chain -> plan mode -> selection */
function handleEscape(){
 if(modalOpen){closeModal();return}
 if($('#ctxMenu').style.display==='block'){hideCtx();return}
 if(ptr.mode==='node'&&tx){deserialize(tx);tx=null;ptr.down=false;ptr.mode=null;draggingNode=null;rebuildScene();$('#marquee').style.display='none';return}
 if(paste){paste=null;clearGhost();renderProps();updateHint();return}
 if(chain.a||planePick.length||measPick){chain.a=null;planePick=[];measPick=null;clearGroup(gWork);clearGhost();updateHint();return}
 if(mode==='plan'){exitPlan();return}
 sel.nodes.clear();sel.rods.clear();sel.planes.clear();selectionChanged()}
/* Ctrl/Cmd shortcuts (dispatcher applies preventDefault for known combos) */
const MOD_ACTIONS={
 KeyZ:e=>{e.shiftKey?redo():undo()},
 KeyY:()=>redo(),
 KeyS:()=>saveQuick(),
 KeyO:()=>savesModal(),
 KeyE:()=>exportJSON(),
 KeyC:()=>copySelection(),
 KeyV:()=>startPaste(),
 KeyG:()=>groupModal(),
 KeyD:()=>cloneSelection(params.clAxis,params.clStep,1)};
/* plain tool-select keys */
const TOOL_KEYS={KeyV:'select',KeyN:'node',KeyO:'support',KeyL:'plane',KeyM:'measure',
 Digit1:'top',Digit2:'bottom',Digit3:'diag',Digit4:'sdiag',Digit5:'post',Digit6:'column',Digit7:'brace',Digit8:'purlin',Digit9:'custom'};
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){handleEscape();return}
 if(modalOpen)return;
 const tag=(e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='select'||tag==='textarea')return;
 const c=e.code,mod=e.ctrlKey||e.metaKey;
 if(mod){const f=MOD_ACTIONS[c];if(f){e.preventDefault();f(e)}return}
 if(e.key==='F1'){e.preventDefault();helpModal();return}
 if(TOOL_KEYS[c]){setTool(TOOL_KEYS[c]);return}
 if(c==='KeyF'){fitAll();return}
 if(c==='KeyH'){if(selCount())hideSelection();return}
 if(c==='Delete'||c==='Backspace'){e.preventDefault();deleteSelection();return}
 if(c==='Enter'&&mode==='plan'){exitPlan();return}});
