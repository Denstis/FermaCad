/* ==================== TYPES: rod types, colors, TOOL_DEFS ==================== */
'use strict';
/* ================= TYPES ================= */
const TYPES={
 top:{label:'Верхний пояс',prefix:'ВП',color:0xff7a45,r:45,hk:'1'},
 bottom:{label:'Нижний пояс',prefix:'НП',color:0x38a1ff,r:45,hk:'2'},
 diag:{label:'Раскос',prefix:'Р',color:0x2fd6a3,r:30,hk:'3'},
 sdiag:{label:'Опорный раскос',prefix:'ОР',color:0xff5fd2,r:34,hk:'4'},
 post:{label:'Стойка',prefix:'СТ',color:0xffd23f,r:30,hk:'5'},
 column:{label:'Столб',prefix:'КЛ',color:0xff5470,r:60,hk:'6'},
 brace:{label:'Связь',prefix:'СВ',color:0xa78bfa,r:22,hk:'7'},
 purlin:{label:'Прогон',prefix:'ПР',color:0x35e0ff,r:32,hk:'8'},
 custom:{label:'Пользовательский',prefix:'ЭЛ',color:0x93a7c4,r:30,hk:'9'}};
const ROD_KEYS=Object.keys(TYPES);
const cssColor=h=>'#'+h.toString(16).padStart(6,'0');
const NODE_COLOR=0xdfe9f8,SUP_COLOR=0xffb020,SEL_COLOR=0xffffff;
const TOOL_DEFS=[
 {sec:'ВЫБОР'},{id:'select',ic:'sel',label:'Выбор / перемещение',hk:'V'},
 {sec:'УЗЛЫ'},{id:'node',ic:'node',label:'Узел',hk:'N'},{id:'support',ic:'support',label:'Опора',hk:'O',c:SUP_COLOR},
 {sec:'СТЕРЖНИ'},
 ...ROD_KEYS.map(k=>({id:k,ic:k,label:TYPES[k].label,hk:TYPES[k].hk,c:TYPES[k].color})),
 {sec:'АНАЛИЗ'},{id:'plane',ic:'plane',label:'Плоскость по 3 узлам',hk:'L',c:0x6fd3ff},{id:'measure',ic:'measure',label:'Измерение',hk:'M',c:0xffc53d}];
