export async function callAI(action: string, selectedText: string, fullContext?: string) {
    const prompt = getPromptForAction(action, selectedText, fullContext);
    const requestBody = { action, text: selectedText, prompt, fullContext };
    
    //console.log('Sending AI request:', { action, selectedTextLength: selectedText.length, fullContextLength: fullContext?.length });
    
    const response = await fetch('/api/editorAi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      throw new Error('AI request failed');
    }
    
    const data = await response.json();
    return data.content;
  }
  
  function getPromptForAction(action: string, selectedText: string, fullContext?: string) {
    const contextSection = fullContext ? `\n\nFull Document Context:\n${fullContext}\n\nSelected Text: "${selectedText}"` : `\n\nSelected Text: "${selectedText}"`;
    
    switch (action) {
      case 'explain':
        return `Please explain the selected text in simple terms, considering the full document context:${contextSection}`;
      case 'summarize':
        return `Please summarize the selected text in 2-3 sentences, considering the full document context:${contextSection}`;
      case 'quiz-me':
        return `Create 3 multiple choice questions based on the selected text, considering the full document context:${contextSection}`;
      case 'diagram':
        return `Create a mermaid diagram for the selected text, considering the full document context:${contextSection}`;
      default:
        return `Process the selected text, considering the full document context:${contextSection}`;
    }
  }