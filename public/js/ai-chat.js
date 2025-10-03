/**
 * AI Chat Interface JavaScript
 * Handles real-time chat functionality with the AI assistant
 */

class AIChatInterface {
    constructor() {
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendButton = document.getElementById('sendButton');
        this.assistantStatus = document.getElementById('assistantStatus');
        this.sessionId = this.generateSessionId();
        this.isLoading = false;
        
        this.initializeEventListeners();
        this.checkAssistantStatus();
        this.startStatusPolling();
    }

    initializeEventListeners() {
        // Send button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Enter key press
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Input validation
        this.messageInput.addEventListener('input', () => {
            const message = this.messageInput.value.trim();
            this.sendButton.disabled = !message || this.isLoading;
        });
    }

    generateSessionId() {
        return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Smart context detection based on message content
     * @param {string} message - User message
     * @returns {string} - Detected context type
     */
    detectContext(message) {
        const lowerMessage = message.toLowerCase();
        
        // Project-specific keywords
        if (lowerMessage.includes('project') || lowerMessage.includes('repository') || lowerMessage.includes('repo')) {
            return 'project';
        }
        
        // Quick wins keywords
        if (lowerMessage.includes('quick win') || lowerMessage.includes('easy') || lowerMessage.includes('simple') || 
            lowerMessage.includes('low hanging') || lowerMessage.includes('immediate')) {
            return 'quickWins';
        }
        
        // Focus areas keywords
        if (lowerMessage.includes('focus') || lowerMessage.includes('priority') || lowerMessage.includes('urgent') || 
            lowerMessage.includes('important') || lowerMessage.includes('critical')) {
            return 'focusAreas';
        }
        
        // Planning keywords
        if (lowerMessage.includes('plan') || lowerMessage.includes('roadmap') || lowerMessage.includes('schedule') || 
            lowerMessage.includes('timeline') || lowerMessage.includes('strategy')) {
            return 'planning';
        }
        
        // Productivity keywords
        if (lowerMessage.includes('productivity') || lowerMessage.includes('efficiency') || lowerMessage.includes('velocity') || 
            lowerMessage.includes('performance') || lowerMessage.includes('optimize')) {
            return 'productivity';
        }
        
        // Quality keywords
        if (lowerMessage.includes('quality') || lowerMessage.includes('code review') || lowerMessage.includes('testing') || 
            lowerMessage.includes('bug') || lowerMessage.includes('technical debt')) {
            return 'quality';
        }
        
        // Portfolio overview keywords
        if (lowerMessage.includes('overview') || lowerMessage.includes('summary') || lowerMessage.includes('all projects') || 
            lowerMessage.includes('portfolio') || lowerMessage.includes('dashboard')) {
            return 'portfolio';
        }
        
        // Default to general for broad questions
        return 'general';
    }

    async sendMessage() {
        const message = this.messageInput.value.trim();
        if (!message || this.isLoading) return;

        // Check if assistant is online before sending
        if (this.assistantStatus.classList.contains('offline')) {
            this.displayMessage('⚠️ GNL Assistant is currently offline. Please check the status and try again.', 'ai');
            return;
        }

        // Add user message to chat
        this.displayMessage(message, 'user');
        
        // Clear input and disable send button
        this.messageInput.value = '';
        this.sendButton.disabled = true;
        this.isLoading = true;
        
        // Show typing indicator
        this.showTypingIndicator();

        try {
            // Fetch AI response
            const response = await this.fetchAIResponse(message);
            this.hideTypingIndicator();
            this.displayMessage(response, 'ai');
        } catch (error) {
            console.error('Error fetching AI response:', error);
            this.hideTypingIndicator();
            this.displayMessage('Sorry, I encountered an error. Please try again.', 'ai');
            // Update status to offline if there was an error
            this.updateStatus('offline', '🔴 Assistant Error');
        } finally {
            this.isLoading = false;
            this.sendButton.disabled = false;
            this.messageInput.focus();
        }
    }

    displayMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        // Format content (handle line breaks and lists)
        if (typeof content === 'string') {
            contentDiv.innerHTML = this.formatMessageContent(content);
        } else {
            contentDiv.textContent = content;
        }
        
        messageDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(messageDiv);
        
        // Scroll to bottom
        this.scrollToBottom();
    }

    formatMessageContent(content) {
        // Convert line breaks to <br> tags
        let formatted = content.replace(/\n/g, '<br>');
        
        // Convert markdown-style lists to HTML lists
        formatted = formatted.replace(/\*\s*(.+)/g, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        return formatted;
    }

    showTypingIndicator() {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message ai-message typing-indicator';
        typingDiv.id = 'typingIndicator';
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.innerHTML = `
            <div class="typing-indicator">
                AI is thinking
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        
        typingDiv.appendChild(contentDiv);
        this.chatMessages.appendChild(typingDiv);
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async fetchAIResponse(message) {
        // Detect the best context for this message
        const detectedContext = this.detectContext(message);
        
        const response = await fetch('/api/v2/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                sessionId: this.sessionId,
                contextType: detectedContext,
                options: {
                    maxTokens: 1500,
                    temperature: 0.7,
                    includeHistory: true
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.success) {
            return data.response;
        } else {
            throw new Error(data.error || 'Unknown error occurred');
        }
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    async checkAssistantStatus() {
        try {
            this.updateStatus('checking', '🔍 Checking status...');
            
            const response = await fetch('/api/v2/ai/health', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    this.updateStatus('online', '🟢 GNL Assistant Online');
                } else {
                    this.updateStatus('offline', '🔴 Assistant Error');
                }
            } else {
                this.updateStatus('offline', '🔴 Assistant Offline');
            }
        } catch (error) {
            console.error('Status check failed:', error);
            this.updateStatus('offline', '🔴 Assistant Offline');
        }
    }

    updateStatus(status, text) {
        this.assistantStatus.className = `assistant-status ${status}`;
        this.assistantStatus.textContent = text;
    }

    startStatusPolling() {
        // Check status every 30 seconds
        setInterval(() => {
            this.checkAssistantStatus();
        }, 30000);
    }
}

// Initialize chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AIChatInterface();
});
