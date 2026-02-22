import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, personaId, personaName } = await request.json();

    if (!prompt || !personaId || !personaName) {
      return NextResponse.json(
        { error: 'Missing required fields: prompt, personaId, personaName' },
        { status: 400 }
      );
    }

    // Extract user input from the prompt for analysis
    const userMatch = prompt.match(/User's latest input:\s*"([^"]+)"/);
    const userInput = userMatch ? userMatch[1].toLowerCase() : '';
    
    // Extract previous discussion context
    const contextMatch = prompt.match(/Previous discussion:\s*\n([\s\S]*?)\n\nUser's latest input:/);
    const context = contextMatch ? contextMatch[1] : '';

    // Generate persona-specific responses based on name and input analysis
    let response = '';

    // Analyze user intent
    const hasDifficulty = userInput.includes('difficult') || userInput.includes('challenge') || userInput.includes('hard') || userInput.includes('confus');
    const hasQuestion = userInput.includes('?') || userInput.includes('how') || userInput.includes('what') || userInput.includes('why');
    const isPositive = userInput.includes('good') || userInput.includes('like') || userInput.includes('love') || userInput.includes('great');
    const isNegative = userInput.includes('bad') || userInput.includes('hate') || userInput.includes('terrible') || userInput.includes('awful');
    const hasSuggestion = userInput.includes('suggest') || userInput.includes('recommend') || userInput.includes('should');

    // Generate responses based on persona characteristics
    if (personaName.toLowerCase().includes('aisha')) {
      if (hasDifficulty) {
        response = 'I noticed the friction point too. The cognitive load seems high here. Maybe we need clearer visual cues or progressive disclosure?';
      } else if (hasQuestion) {
        response = 'Good question. From a user experience perspective, we should consider the mental model users bring to this interaction.';
      } else if (isPositive) {
        response = 'That\'s encouraging! The positive feedback suggests this part of the flow works well. Should we double down on this approach?';
      } else {
        response = 'Let me think about this from the user\'s perspective. The flow could benefit from more intuitive signposting.';
      }
    } else if (personaName.toLowerCase().includes('juan')) {
      if (hasDifficulty) {
        response = 'I\'m concerned about the accessibility implications here. We should run this through some usability testing with diverse users.';
      } else if (hasQuestion) {
        response = 'That\'s a critical question. The answer depends on our target user personas and their technical comfort level.';
      } else if (isPositive) {
        response = 'I agree with the user\'s assessment. This aligns with usability best practices we should maintain.';
      } else {
        response = 'From a practical standpoint, we need to balance innovation with familiarity. Users shouldn\'t have to relearn everything.';
      }
    } else if (personaName.toLowerCase().includes('liam')) {
      if (hasDifficulty) {
        response = 'The user\'s struggle indicates a potential breakdown in the user journey. We should map out the complete flow to identify pain points.';
      } else if (hasQuestion) {
        response = 'Interesting question. Let me consider this from a systems thinking perspective - how does this choice affect downstream interactions?';
      } else if (isPositive) {
        response = 'Great observation! This suggests we\'re meeting user expectations. We should document what makes this work well.';
      } else {
        response = 'I\'m thinking about the edge cases here. What happens when users deviate from the happy path?';
      }
    } else if (personaName.toLowerCase().includes('sophia')) {
      if (hasDifficulty) {
        response = 'I sense some emotional friction here. Beyond the usability issue, how might users feel about this interaction?';
      } else if (hasQuestion) {
        response = 'That question touches on an important aspect. We should consider the emotional journey users take through this flow.';
      } else if (isPositive) {
        response = 'Wonderful! The user\'s positive reaction suggests we\'re creating the right emotional experience.';
      } else {
        response = 'Let me approach this holistically. How does this interaction fit into the broader user experience and brand perception?';
      }
    } else if (personaName.toLowerCase().includes('hiroshi')) {
      if (hasDifficulty) {
        response = 'This complexity concerns me. We should apply the principle of reduction - what can we remove to make this clearer?';
      } else if (hasQuestion) {
        response = 'From a minimal design perspective, the answer should be simple and direct. Are we overthinking this?';
      } else if (isPositive) {
        response = 'Excellent. The simplicity that works here is something we should apply more broadly across the design.';
      } else {
        response = 'I\'m evaluating this through the lens of efficiency and clarity. Every element should have a clear purpose.';
      }
    } else {
      // Default fallback for unknown personas
      if (hasDifficulty) {
        response = 'I share the user\'s concern. This part of the flow needs simplification and clearer guidance.';
      } else if (hasQuestion) {
        response = 'That\'s an important consideration. We should think through the implications for user understanding.';
      } else if (isPositive) {
        response = 'I agree with the user\'s positive assessment. This approach seems to be working well.';
      } else {
        response = 'Let me consider this from a user experience perspective. We should prioritize clarity and ease of use.';
      }
    }

    // Add reference to previous speakers if context exists
    if (context && context.trim()) {
      const previousSpeakers = context.split('\n').filter((line: string) => line.trim());
      if (previousSpeakers.length > 0) {
        response = `Building on what others have said, ${response}`;
      }
    }

    return NextResponse.json({
      response: response.trim(),
      personaId,
      personaName,
    });

  } catch (error) {
    console.error('Focus group response error:', error);
    return NextResponse.json(
      { error: 'Failed to generate persona response' },
      { status: 500 }
    );
  }
}
