import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'

export async function POST(request: NextRequest) {
  try {
    const { styleIds } = await request.json()
    
    if (!styleIds || !Array.isArray(styleIds)) {
      return NextResponse.json(
        { error: 'Style IDs array is required' },
        { status: 400 }
      )
    }

    console.log('Starting FlexPLM automation for style IDs:', styleIds)

    // Launch browser
    const browser = await puppeteer.launch({
      headless: true, // เปลี่ยนเป็น true สำหรับ Windows Server
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // เพิ่มบรรทัดนี้
        '--disable-gpu', // เพิ่มบรรทัดนี้
        '--no-first-run',
        '--no-zygote',
        '--single-process', // เพิ่มบรรทัดนี้สำหรับ Windows Server
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--ignore-certificate-errors',
        '--ignore-ssl-errors',
        '--allow-running-insecure-content'
      ]
    })

    const page = await browser.newPage()
    
    // Set viewport
    await page.setViewport({ width: 1366, height: 768 })

    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

    // Set up HTTP Basic Authentication
    await page.authenticate({
      username: 'tapanej',
      password: 'Kennet@tan1'
    })

    try {
      // Navigate to FlexPLM with HTTP Basic Auth
      console.log('Navigating to FlexPLM with authentication...')
      
      await page.goto('https://flexplm.carters.com/Windchill/rfa/jsp/main/Main.jsp', {
        waitUntil: 'networkidle2',
        timeout: 30000
      })

      // Wait for page to fully load and JavaScript to execute
      await new Promise(resolve => setTimeout(resolve, 8000))

      console.log('Page title:', await page.title())
      console.log('Current URL:', page.url())
      
      console.log('Login successful, processing style IDs...')

      const results = []

      // Process each style ID
      for (const styleId of styleIds) {
        // Initialize productInfo object for this style ID
        let productInfo: any = { 
          content: '',
          colorwayInfo: '',
          bomData: '',
          productDetails: ''
        }
        
        try {
          console.log(`Processing style ID: ${styleId}`)
          
          // Trim last 2 digits from style ID before searching
          const trimmedStyleId = styleId.length >= 2 ? styleId.slice(0, -2) : styleId
          console.log(`Original style ID: ${styleId} -> Trimmed for search: ${trimmedStyleId}`)
          
          // Step 1: Switch to sidebar iframe
          console.log('Switching to sidebar iframe...')
          await page.waitForSelector('iframe[name="sidebarframe"]', { timeout: 10000 })
          
          const sidebarFrame = await page.frames().find(frame => frame.name() === 'sidebarframe')
          if (!sidebarFrame) {
            throw new Error('Sidebar iframe not found')
          }
          
          // Step 1.5: Click on "Site" tab first to ensure navigation is reset
          console.log('Clicking on Site tab to reset navigation...')
          try {
            await sidebarFrame.waitForSelector('#siteNavLink', { timeout: 5000 })
            await sidebarFrame.click('#siteNavLink')
            console.log('Site tab clicked successfully')
            
            // Wait for Site tab to load
            await new Promise(resolve => setTimeout(resolve, 2000))
          } catch (siteError) {
            console.log('Site tab not found, continuing...', siteError)
          }
          
          // Step 2: Click on "Product" link in sidebar
          console.log('Clicking on Product link...')
          await sidebarFrame.waitForSelector('a[href="javascript:findProduct()"]', { timeout: 10000 })
          await sidebarFrame.click('a[href="javascript:findProduct()"]')
          
          // Wait for the findProduct function to execute and load search interface
          await new Promise(resolve => setTimeout(resolve, 5000))
          
          // Step 3: Switch to content iframe and find the product name input
          console.log('Switching to content iframe...')
          await page.waitForSelector('iframe[name="contentframe"]', { timeout: 10000 })
          
          const contentFrame = await page.frames().find(frame => frame.name() === 'contentframe')
          if (!contentFrame) {
            throw new Error('Content iframe not found')
          }
          
          // Step 4: Find and fill the product name input field
          console.log(`Looking for product name input field...`)
          const productNameSelector = 'input[name="LCSPRODUCT_ptc_str_1"], input[id="LCSPRODUCT_ptc_str_1"]'
          
          try {
            await contentFrame.waitForSelector(productNameSelector, { timeout: 10000 })
            console.log('Found product name input field')
            
            // Clear and enter trimmed style ID
            await contentFrame.click(productNameSelector, { clickCount: 3 }) // Select all
            await contentFrame.type(productNameSelector, trimmedStyleId)
            
            console.log(`Entered trimmed style ID: ${trimmedStyleId} in product name field`)
            
            // Step 5: Look for the specific Search button
            console.log('Looking for Search button...')
            const searchButtonSelectors = [
              'a#SearchButton2.button[href="javascript:search()"]',
              '#SearchButton2',
              'a[id="SearchButton2"]',
              'a.button[href="javascript:search()"]',
              'a[href="javascript:search()"]'
            ]
            
            let searchButtonFound = false
            for (const buttonSelector of searchButtonSelectors) {
              try {
                console.log(`Trying search button selector: ${buttonSelector}`)
                const searchButton = await contentFrame.$(buttonSelector)
                if (searchButton) {
                  console.log(`Found search button with selector: ${buttonSelector}`)
                  await searchButton.click()
                  searchButtonFound = true
                  break
                }
              } catch (e) {
                console.log(`Search button selector ${buttonSelector} not found, trying next...`)
              }
            }
            
            if (!searchButtonFound) {
              // Try pressing Enter as fallback
              console.log('Search button not found, trying Enter key...')
              await page.keyboard.press('Enter')
            }
            
            // Wait for search results
            console.log('Waiting for search results...')
            await new Promise(resolve => setTimeout(resolve, 5000))
            
            // New steps: Navigate to Specifications > BOM and handle colorway selection
            try {
              console.log('Step 6: Looking for menu-bar...')
              
              // Look for menu-bar class
              const menuBarSelector = '.menu-bar'
              await contentFrame.waitForSelector(menuBarSelector, { timeout: 10000 })
              console.log('Found menu-bar')
              
              // Step 7: Click on Specifications menu
              console.log('Step 7: Looking for Specifications menu...')
              const specificationsSelectors = [
                '.menu-bar a[href*="Specifications"]',
                '.menu-bar a:contains("Specifications")',
                '.menu-bar li:contains("Specifications") a',
                '.menu-bar [title="Specifications"]',
                '.menu-bar *[data-menu="Specifications"]'
              ]
              
              let specificationsFound = false
              for (const selector of specificationsSelectors) {
                try {
                  const specificationsMenu = await contentFrame.$(selector)
                  if (specificationsMenu) {
                    console.log(`Found Specifications menu with selector: ${selector}`)
                    await specificationsMenu.click()
                    specificationsFound = true
                    break
                  }
                } catch (e) {
                  // Try next selector
                }
              }
              
                              if (!specificationsFound) {
                  // Try to find by text content
                  const specificationsClicked = await contentFrame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('.menu-bar a, .menu-bar span, .menu-bar li'))
                    const specificationsEl = elements.find(el => el.textContent?.includes('Specifications'))
                    if (specificationsEl && specificationsEl instanceof HTMLElement) {
                      specificationsEl.click()
                      return true
                    }
                    return false
                  })
                  
                  if (specificationsClicked) {
                    console.log('Found and clicked Specifications menu by text content')
                    specificationsFound = true
                  }
                }
              
              if (!specificationsFound) {
                console.log('Specifications menu not found, continuing with current data extraction...')
              } else {
                // Wait for Specifications menu to load
                await new Promise(resolve => setTimeout(resolve, 3000))
                
                // Step 8: Look for BOM sub menu
                console.log('Step 8: Looking for BOM sub menu...')
                const bomSelectors = [
                  'a[href*="BOM"]',
                  'a:contains("BOM")',
                  'li:contains("BOM") a',
                  '[title="BOM"]',
                  '*[data-menu="BOM"]'
                ]
                
                let bomFound = false
                for (const selector of bomSelectors) {
                  try {
                    const bomMenu = await contentFrame.$(selector)
                    if (bomMenu) {
                      console.log(`Found BOM sub menu with selector: ${selector}`)
                      await bomMenu.click()
                      bomFound = true
                      break
                    }
                  } catch (e) {
                    // Try next selector
                  }
                }
                
                if (!bomFound) {
                  // Try to find by text content
                  const bomClicked = await contentFrame.evaluate(() => {
                    const elements = Array.from(document.querySelectorAll('a, span, li'))
                    const bomEl = elements.find(el => el.textContent?.includes('BOM'))
                    if (bomEl && bomEl instanceof HTMLElement) {
                      bomEl.click()
                      return true
                    }
                    return false
                  })
                  
                  if (bomClicked) {
                    console.log('Found and clicked BOM menu by text content')
                    bomFound = true
                  }
                }
                
                if (bomFound) {
                  // Wait for BOM page to load
                  await new Promise(resolve => setTimeout(resolve, 5000))
                  
                                     // Step 9: Handle colorway name selection via dropdown
                   console.log('Step 9: Looking for colorway name dropdown...')
                   
                   try {
                                          // First, find and click the colorway dropdown to open it
                     const dropdownClicked = await contentFrame.evaluate(() => {
                       // Look for the Select2 dropdown for contextSKUId with multiple approaches
                       let select2Container = document.querySelector('.select2-container[data-select2-id="7"]') ||
                                            document.querySelector('span[data-select2-id="7"]') ||
                                            document.querySelector('.select2-selection[aria-labelledby="select2-contextSKUId-container"]') ||
                                            document.querySelector('#select2-contextSKUId-container')?.parentElement?.parentElement
                       
                       if (select2Container) {
                         console.log('Found Select2 container for colorway:', select2Container)
                         const selection = select2Container.querySelector('.select2-selection') as HTMLElement
                         if (selection) {
                           // Try multiple click approaches
                           selection.click()
                           selection.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                           selection.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
                           return { clicked: true, type: 'select2' }
                         }
                       }
                       
                       // Alternative: look for Select2 by searching for the rendered text
                       const select2WithColorway = Array.from(document.querySelectorAll('.select2-selection__rendered')).find(el => 
                         el.textContent?.includes('GPW LOVE') || el.textContent?.includes('PC Set')
                       )
                       
                       if (select2WithColorway) {
                         console.log('Found Select2 by content:', select2WithColorway.textContent)
                         const selection = select2WithColorway.closest('.select2-selection') as HTMLElement
                         if (selection) {
                           selection.click()
                           selection.dispatchEvent(new MouseEvent('click', { bubbles: true }))
                           return { clicked: true, type: 'select2-by-content' }
                         }
                       }
                       
                       // Fallback: try to find the original select element
                       const colorwaySelect = document.querySelector('select[name="contextSKUId"], select[id="contextSKUId"]') as HTMLSelectElement
                       if (colorwaySelect) {
                         console.log('Found original select element:', colorwaySelect)
                         colorwaySelect.click()
                         colorwaySelect.focus()
                         // Simulate opening dropdown
                         const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
                         colorwaySelect.dispatchEvent(event)
                         return { clicked: true, type: 'select' }
                       }
                       
                       return { clicked: false, error: 'No dropdown element found' }
                     })
                     
                     if (!dropdownClicked.clicked) {
                       throw new Error(`Failed to click dropdown: ${dropdownClicked.error}`)
                     }
                     
                     console.log(`Clicked colorway dropdown (${dropdownClicked.type})`)
                     
                     // Wait for dropdown options to appear
                     await new Promise(resolve => setTimeout(resolve, 2000))
                     
                     // Now select an option that contains style information
                     const colorwaySelectionResult = await contentFrame.evaluate(() => {
                       // For Select2 dropdown, look for dropdown options with multiple selectors
                       let dropdownOptions = document.querySelectorAll(
                         '.select2-results__option, .select2-dropdown li, .select2-results li, ' +
                         '.select2-results__option--highlighted, .select2-results__option[role="option"]'
                       )
                       
                       console.log(`Found ${dropdownOptions.length} Select2 dropdown options`)
                       
                       // If no Select2 options, try regular select options
                       if (dropdownOptions.length === 0) {
                         const colorwaySelect = document.querySelector('select[name="contextSKUId"], select[id="contextSKUId"]') as HTMLSelectElement
                         if (colorwaySelect && colorwaySelect.options.length > 1) {
                           // Find option with style information (not "-- None Selected --")
                           for (let i = 0; i < colorwaySelect.options.length; i++) {
                             const option = colorwaySelect.options[i]
                             if (option.value && 
                                 option.value !== '' && 
                                 !option.title.includes('-- None Selected --') &&
                                 option.text.trim() !== '' &&
                                 (option.text.includes('PC Set') || option.text.includes('GPW') || /\d+$/.test(option.text))) {
                               
                               // Select this option
                               colorwaySelect.value = option.value
                               colorwaySelect.selectedIndex = i
                               
                               // Trigger events
                               colorwaySelect.dispatchEvent(new Event('change', { bubbles: true }))
                               colorwaySelect.dispatchEvent(new Event('input', { bubbles: true }))
                               
                               if (colorwaySelect.onchange) {
                                 colorwaySelect.onchange(new Event('change'))
                               }
                               
                               return {
                                 found: true,
                                 selectedText: option.text.trim(),
                                 selectedValue: option.value,
                                 selectedTitle: option.title,
                                 method: 'select'
                               }
                             }
                           }
                         }
                       } else {
                         // Handle Select2 dropdown options - select first valid option
                         for (let i = 0; i < dropdownOptions.length; i++) {
                           const option = dropdownOptions[i] as HTMLElement
                           const optionText = option.textContent || ''
                           
                           // Select first option that has content and is not "-- None Selected --" or "-- View All --"
                           if (optionText.trim() && 
                               !optionText.includes('-- None Selected --') &&
                               !optionText.includes('None Selected') &&
                               !optionText.includes('-- View All --') &&
                               !optionText.includes('View All')) {
                             
                             console.log('Clicking first valid Select2 option:', optionText)
                             
                             // Try multiple click methods to ensure option is selected
                             option.click()
                             option.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
                             option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
                             option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }))
                             
                             // Also try focusing and triggering selection
                             if (option.focus) {
                               option.focus()
                             }
                             
                             return {
                               found: true,
                               selectedText: optionText.trim(),
                               selectedValue: 'select2-option',
                               selectedTitle: optionText.trim(),
                               method: 'select2'
                             }
                           }
                         }
                       }
                       
                       return { found: false, error: 'No valid colorway option with style found' }
                     })
                     
                     let selectionFound = colorwaySelectionResult.found
                     if (selectionFound) {
                       console.log(`Successfully selected colorway via ${colorwaySelectionResult.method}: ${colorwaySelectionResult.selectedText}`)
                       console.log(`Colorway value: ${colorwaySelectionResult.selectedValue}`)
                       console.log(`Colorway title: ${colorwaySelectionResult.selectedTitle}`)
                       
                       // Wait for option selection to take effect and dropdown to close
                       console.log('Waiting for option selection to take effect...')
                       await new Promise(resolve => setTimeout(resolve, 3000))
                       
                       // Verify the selection was applied
                       const selectionVerified = await contentFrame.evaluate(() => {
                         // Check if the selected option is now displayed in the Select2 container
                         const select2Rendered = document.querySelector('.select2-selection__rendered')
                         if (select2Rendered) {
                           const displayedText = select2Rendered.textContent || ''
                           console.log('Currently displayed in Select2:', displayedText)
                           return { verified: true, displayedText }
                         }
                         return { verified: false, displayedText: 'Not found' }
                       })
                       
                       if (selectionVerified.verified) {
                         console.log(`Selection verified: ${selectionVerified.displayedText}`)
                       } else {
                         console.log('Selection verification failed')
                       }
                     } else {
                       console.log(`Colorway selection failed: ${colorwaySelectionResult.error}`)
                       
                       // Try alternative approach - look for any available option
                       console.log('Trying alternative selection method...')
                       const alternativeResult = await contentFrame.evaluate(() => {
                         const colorwaySelect = document.querySelector('select[name="contextSKUId"], select[id="contextSKUId"]') as HTMLSelectElement
                         if (colorwaySelect && colorwaySelect.options.length > 1) {
                           // Just select the first non-empty option
                           for (let i = 1; i < colorwaySelect.options.length; i++) {
                             const option = colorwaySelect.options[i]
                             if (option.value && option.value.trim() !== '') {
                               colorwaySelect.selectedIndex = i
                               colorwaySelect.dispatchEvent(new Event('change', { bubbles: true }))
                               return {
                                 found: true,
                                 selectedText: option.text.trim(),
                                 selectedValue: option.value
                               }
                             }
                           }
                         }
                         return { found: false, error: 'No alternative options found' }
                       })
                       
                       if (alternativeResult.found) {
                         console.log(`Alternative selection successful: ${alternativeResult.selectedText}`)
                         selectionFound = true
                       } else {
                         console.log(`Alternative selection also failed: ${alternativeResult.error}`)
                       }
                     }
                    
                    if (!selectionFound) {
                      console.log('Colorway selection not found, continuing with current data...')
                    } else {
                      // Wait for colorway selection to process and page to update
                      console.log('Waiting for colorway selection to process...')
                      await new Promise(resolve => setTimeout(resolve, 5000))
                      
                      // Verify the selection was successful by checking if BOM data loaded
                      const bomDataLoaded = await contentFrame.evaluate(() => {
                        // Look for BOM related content or tables
                        const bomTables = document.querySelectorAll('table, .table-wrapper, .f-attribute-group')
                        return bomTables.length > 0
                      })
                      
                      if (bomDataLoaded) {
                        console.log('BOM data appears to be loaded after colorway selection')
                      } else {
                        console.log('BOM data may not have loaded yet, continuing anyway...')
                      }
                    }
                    
                  } catch (colorwayError) {
                    console.log('Colorway selector not found, continuing with current data...')
                  }
                } else {
                  console.log('BOM sub menu not found, continuing with current data extraction...')
                }
              }
              
            } catch (menuError) {
              console.log('Menu navigation error, continuing with current data extraction:', menuError)
            }
            
          } catch (inputError) {
            console.log(`Product name input not found for ${styleId}, trying alternative selectors...`)
            
            // Try alternative selectors
            const alternativeSelectors = [
              'input[type="text"][name*="PRODUCT"]',
              'input[type="text"][id*="PRODUCT"]',
              'input[type="text"][name*="ptc_str"]',
              'input[type="text"]'
            ]
            
            let inputFound = false
            for (const selector of alternativeSelectors) {
              try {
                const input = await contentFrame.$(selector)
                if (input) {
                  console.log(`Found input with alternative selector: ${selector}`)
                  await input.click({ clickCount: 3 })
                  await input.type(trimmedStyleId)
                  
                  // Try to find search button after entering text
                  const searchButton = await contentFrame.$('a#SearchButton2.button[href="javascript:search()"]') || 
                                     await contentFrame.$('#SearchButton2') ||
                                     await contentFrame.$('a[href="javascript:search()"]')
                  
                  if (searchButton) {
                    await searchButton.click()
                  } else {
                    await page.keyboard.press('Enter')
                  }
                  
                  inputFound = true
                  break
                }
              } catch (e) {
                // Continue to next selector
              }
            }
            
            if (!inputFound) {
              throw new Error(`Product name input field not found for style ID: ${styleId}`)
            }
            
            await new Promise(resolve => setTimeout(resolve, 5000))
          }

          // Extract BOM data and create component details
          const extractedInfo = await contentFrame.evaluate(() => {
            const info: any = { 
              content: '',
              colorwayInfo: '',
              bomData: '',
              productDetails: '',
              componentDetails: ''
            }
            
            // Helper function to robustly get cell text
            const getCellText = (cell: Element | null): string => {
              if (!cell) {
                return '';
              }
              // Try to find an anchor tag first and use its innerText
              const anchor = cell.querySelector('a');
              if (anchor) {
                return (anchor.textContent || '').trim();
              }
              // Fallback to the cell's textContent
              return (cell.textContent || '').trim();
            };

            // Get colorway information
            const colorwaySelect = document.querySelector('select[name="contextSKUId"], select[id="contextSKUId"]') as HTMLSelectElement
            if (colorwaySelect && colorwaySelect.selectedIndex >= 0) {
              const selectedOption = colorwaySelect.options[colorwaySelect.selectedIndex]
              info.colorwayInfo = `Selected Colorway: ${selectedOption.text} (Value: ${selectedOption.value})`
            }
            
            // Extract BOM table data and create component details
            console.log('Starting BOM table extraction...')
            
            // Find all tables that might contain BOM data
            const allTables = document.querySelectorAll('table')
            console.log(`Found ${allTables.length} tables on page`)
            
            let bomTableFound = false
            let bomRows: any[] = []
            
            // Look for BOM table with required columns
            for (let tableIndex = 0; tableIndex < allTables.length; tableIndex++) {
              const table = allTables[tableIndex]
              const headerRow = table.querySelector('tr')
              
              if (!headerRow) continue
              
              const headers = Array.from(headerRow.querySelectorAll('th, td')).map(cell => 
                (cell.textContent || '').trim().toLowerCase()
              )
              
              console.log(`Table ${tableIndex} headers:`, headers)
              
              // Check if this table has the required columns
              const requiredColumns = [
                'material attribute',
                'body', 
                'sc body descriptor',
                'sc body',
                'placement',
                'material position', 
                'material',
                'color'
              ]
              
              const columnIndices: { [key: string]: number } = {}
              let hasRequiredColumns = true
              
              for (const requiredCol of requiredColumns) {
                // Use exact match for header to avoid ambiguity e.g. 'material' matching 'material position'
                const index = headers.findIndex(header => header === requiredCol)
                
                if (index !== -1) {
                  columnIndices[requiredCol] = index
                } else {
                  console.log(`Required column not found with exact match: "${requiredCol}"`)
                  hasRequiredColumns = false
                  break
                }
              }
              
              if (hasRequiredColumns) {
                console.log('Found BOM table with required columns!')
                console.log('Column indices:', columnIndices)
                bomTableFound = true
                
                // Extract data rows (skip header row)
                const dataRows = Array.from(table.querySelectorAll('tr')).slice(1)
                
                dataRows.forEach((row, rowIndex) => {
                  const cells = Array.from(row.querySelectorAll('th, td'))
                  
                  if (cells.length >= Math.max(...Object.values(columnIndices))) {
                    const rowData = {
                      materialAttribute: getCellText(cells[columnIndices['material attribute']]),
                      body: getCellText(cells[columnIndices['body']]),
                      scBodyDescriptor: getCellText(cells[columnIndices['sc body descriptor']]),
                      scBody: getCellText(cells[columnIndices['sc body']]),
                      placement: getCellText(cells[columnIndices['placement']]),
                      materialPosition: getCellText(cells[columnIndices['material position']]),
                      material: getCellText(cells[columnIndices['material']]),
                      color: getCellText(cells[columnIndices['color']])
                    }
                    
                    // Only add rows that have meaningful data and filter out Material Attribute = "Misc"
                    if ((rowData.body || rowData.scBody || rowData.material) && 
                        rowData.materialAttribute.toLowerCase() !== 'misc') {
                      bomRows.push(rowData)
                      console.log(`Row ${rowIndex}:`, rowData)
                    } else if (rowData.materialAttribute.toLowerCase() === 'misc') {
                      console.log(`Filtered out row ${rowIndex} with Material Attribute = "Misc":`, rowData)
                    }
                  }
                })
                
                break // Found the BOM table, no need to check other tables
              }
            }
            
            if (bomTableFound && bomRows.length > 0) {
              console.log(`Found ${bomRows.length} BOM rows`)
              
              // Group by Body
              const groupedByBody: { [key: string]: any[] } = {}
              
              bomRows.forEach(row => {
                const bodyKey = row.body || 'Unknown Body'
                if (!groupedByBody[bodyKey]) {
                  groupedByBody[bodyKey] = []
                }
                groupedByBody[bodyKey].push(row)
              })
              
              console.log('Grouped by body:', Object.keys(groupedByBody))
              
              // Create component details string
              const componentGroups: string[] = []
              
              Object.entries(groupedByBody).forEach(([bodyKey, rows]) => {
                if (rows.length > 0) {
                  // Create group header from first row: ${scBodyDescription} : ${scBody}
                  const firstRow = rows[0]
                  const groupHeader = `${firstRow.scBodyDescriptor || 'SC Body Description'} : ${firstRow.scBody || bodyKey}`
                  
                  // Create detail parts for all rows: ${placement} : ${materialPosition} : ${material} : ${color}
                  const detailParts = rows.map(row => 
                    `${row.placement || 'Placement'} : ${row.materialPosition || ''} : ${row.material || 'Material'} : ${row.color || 'Color'}`
                  )
                  
                  // Combine group header + detail parts with \n
                  const groupString = [groupHeader, ...detailParts].join('\n')
                  componentGroups.push(groupString)
                }
              })
              
              // Join all groups with \n\n (double newline)
              info.componentDetails = componentGroups.join('\n\n')
              
              console.log('Generated component details:')
              console.log(info.componentDetails)
              
              info.bomData = `Extracted ${bomRows.length} BOM rows, grouped into ${componentGroups.length} body groups`
              
            } else {
              console.log('BOM table not found or no data extracted')
              info.bomData = 'BOM table not found or no data could be extracted'
              info.componentDetails = 'No component details available'
            }
            
            // Get basic product information
            const productElements = document.querySelectorAll('table tr, .product-info, .search-result, td, div')
            productElements.forEach(element => {
              const text = element.textContent || ''
              if (text.includes('Style') || text.includes('Product') || text.includes('Description') || 
                  text.includes('Name') || text.includes('ID') || text.includes('Number')) {
                info.content += text.trim() + '\n'
              }
            })
            
            // Get specific product details from attribute boxes
            const attributeBoxes = document.querySelectorAll('.f-attribute-box')
            attributeBoxes.forEach(box => {
              const title = box.querySelector('.input-title')?.textContent
              const value = box.querySelector('.display-only-label')?.textContent
              if (title && value && value.trim()) {
                info.productDetails += `${title}: ${value.trim()}\n`
              }
            })
            
            return info
          })

          // Merge extracted info with productInfo
          productInfo = { ...productInfo, ...extractedInfo }

          // Log component details to console for verification
          if (extractedInfo.componentDetails && extractedInfo.componentDetails !== 'No component details available') {
            console.log(`\n=== COMPONENT DETAILS FOR ${styleId} ===`)
            console.log(extractedInfo.componentDetails)
            console.log(`=== END COMPONENT DETAILS FOR ${styleId} ===\n`)
          } else {
            console.log(`No component details extracted for ${styleId}`)
          }

          results.push({
            styleId,
            trimmedStyleId,
            success: true,
            data: productInfo
          })

          console.log(`Successfully processed ${styleId} (searched as ${trimmedStyleId})`)
          
        } catch (error) {
          console.error(`Error processing style ID ${styleId}:`, error)
          results.push({
            styleId,
            trimmedStyleId: styleId.length >= 2 ? styleId.slice(0, -2) : styleId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      await browser.close()

      return NextResponse.json({
        success: true,
        results,
        message: `Processed ${results.length} style IDs`
      })

    } catch (error) {
      await browser.close()
      throw error
    }

  } catch (error) {
    console.error('FlexPLM automation error:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to perform FlexPLM automation'
    let errorDetails = error instanceof Error ? error.message : 'Unknown error'
    
    if (errorDetails.includes('ERR_INVALID_AUTH_CREDENTIALS')) {
      errorMessage = 'Authentication error - URL may require different credentials or VPN access'
      errorDetails = 'The FlexPLM system returned an authentication error. This could mean:\n' +
                    '1. The URL requires VPN access\n' +
                    '2. The credentials are incorrect\n' +
                    '3. The system uses different authentication method\n' +
                    '4. The URL has changed or is not accessible'
    } else if (errorDetails.includes('net::ERR_NAME_NOT_RESOLVED')) {
      errorMessage = 'Network error - Cannot resolve domain'
      errorDetails = 'Cannot access flexplm.carters.com. Check internet connection or VPN access.'
    } else if (errorDetails.includes('timeout')) {
      errorMessage = 'Timeout error - Page took too long to load'
      errorDetails = 'The FlexPLM page took too long to respond. Try again or check network connection.'
    }
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: errorDetails,
        suggestion: 'Try accessing the FlexPLM URL manually in a browser first to verify it works'
      },
      { status: 500 }
    )
  }
}
