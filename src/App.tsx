const s: any = {
  // ... resto degli stili invariato
  inputWrapper: { 
    display: 'flex', 
    alignItems: 'center', // Centra verticalmente gli elementi (clip, textarea, button)
    gap: '12px', 
    background: 'white', 
    padding: '10px 25px', 
    borderRadius: '30px', 
    border: '2px solid #e2e8f0', 
    marginTop: '10px',
    minHeight: '60px' // Altezza minima per garantire la centratura visiva
  },
  textarea: { 
    flex: 1, 
    border: 'none', 
    outline: 'none', 
    resize: 'none', 
    fontSize: '16px', 
    padding: '8px 0', 
    fontFamily: 'inherit',
    textAlign: 'center', // Centra il testo orizzontalmente mentre scrivi
    lineHeight: '1.5',
    display: 'flex',
    alignItems: 'center'
  },
  // ... resto degli stili
};
