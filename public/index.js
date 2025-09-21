const fileInput = document.getElementById('fileInput');
        const uploadArea = document.querySelector('.upload-area');
        const fileInfo = document.getElementById('fileInfo');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const placeholder = document.getElementById('placeholder');
        const loading = document.getElementById('loading');
        const results = document.getElementById('results');

        let selectedFile = null;

        // Drag and drop handlers
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleFileSelect(files[0]);
            }
        });

        // File input handler
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });

        // Handle file selection
        function handleFileSelect(file) {
            selectedFile = file;
            
            // Show file info
            document.getElementById('fileName').textContent = file.name;
            document.getElementById('fileSize').textContent = formatFileSize(file.size);
            document.getElementById('fileType').textContent = file.type || 'Unknown';
            
            fileInfo.style.display = 'block';
            analyzeBtn.disabled = false;
        }

        // Format file size
        function formatFileSize(bytes) {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }

        // Analyze button handler
        analyzeBtn.addEventListener('click', async () => {
            if (!selectedFile) return;

            // Show loading state
            placeholder.style.display = 'none';
            results.style.display = 'none';
            loading.style.display = 'block';
            analyzeBtn.disabled = true;

            try {
                const formData = new FormData();
                formData.append('document', selectedFile);

                const response = await fetch('/api/analyze', {
                    method: 'POST',
                    body: formData
                });

                if (!response.ok) {
                    throw new Error('Analysis failed');
                }

                const analysisResult = await response.json();
                displayResults(analysisResult);

            } catch (error) {
                console.error('Error:', error);
                displayError('Failed to analyze document. Please try again.');
            } finally {
                loading.style.display = 'none';
                analyzeBtn.disabled = false;
            }
        });
        // Format API text into readable HTML
function formatText(text) {
    if (!text) return "No information found.";

    return text
        .replace(/^- (.*)$/gm, "<li>$1</li>")
        .replace(/^\* (.*)$/gm, "<li>$1</li>")
        .replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>")
        .replace(/\n/g, "<br>");
}


        // Display analysis results
        function displayResults(analysisResult) {
            loading.style.display = 'none';
            
            // Parse the analysis text to extract sections
            const analysis = analysisResult.analysis;
            
            results.innerHTML = `
                <div class="result-section important">
                    <h2>📋 Key Important Points</h3>
                    <div class="result-content">${formatText(extractSection(analysis, 'KEY IMPORTANT POINTS', 'SUSPICIOUS ELEMENTS'))}</div>

                </div>
                
                <div class="result-section suspicious">
                    <h2>⚠️ Suspicious Elements</h3>
                    <div class="result-content">${formatText(extractSection(analysis, 'SUSPICIOUS ELEMENTS', 'RISK ASSESSMENT'))}</div>
                </div>
                
                <div class="result-section risk">
                    <h2>📊 Risk Assessment</h3>
                    <div class="result-content">${formatText(extractSection(analysis, 'RISK ASSESSMENT', 'RECOMMENDATIONS'))}</div>
                </div>
                
                <div class="result-section">
                    <h2>💡 Recommendations</h3>
                    <div class="result-content">${formatText(extractSection(analysis, 'RECOMMENDATIONS', null))}</div>
                </div>
                
                <div style="margin-top: 20px; padding: 15px; background: #e9ecef; border-radius: 8px; font-size: 0.9em; color: #666;">
                    <strong>Analysis completed:</strong> ${new Date().toLocaleString()}<br>
                    <strong>Document:</strong> ${analysisResult.fileName}
                </div>
            `;
            
            results.style.display = 'block';
        }

        // Extract specific section from analysis
        function extractSection(text, startMarker, endMarker) {
            const startIndex = text.indexOf(startMarker);
            if (startIndex === -1) return 'No information found.';
            
            const contentStart = startIndex + startMarker.length;
            let contentEnd = text.length;
            
            if (endMarker) {
                const endIndex = text.indexOf(endMarker, contentStart);
                if (endIndex !== -1) {
                    contentEnd = endIndex;
                }
            }
            
            return text.substring(contentStart, contentEnd).trim();
        }

        // Display error message
        function displayError(message) {
            results.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #e74c3c;">
                    <div style="font-size: 2em; margin-bottom: 15px;">❌</div>
                    <p>${message}</p>
                </div>
            `;
            results.style.display = 'block';
        }