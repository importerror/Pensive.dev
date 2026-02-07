import requests
import json
import sys
from datetime import datetime

class RCAReviewerAPITester:
    def __init__(self, base_url="https://34e1f9c7-ba43-4a89-9083-18ec47800fb6.preview.emergentagent.com"):
        self.base_url = base_url
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, timeout=30):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        if data:
            print(f"   Data: {json.dumps(data, indent=2)}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=timeout)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=timeout)

            print(f"   Response Status: {response.status_code}")
            
            try:
                response_data = response.json()
                print(f"   Response Data: {json.dumps(response_data, indent=2)}")
            except:
                print(f"   Response Text: {response.text[:200]}...")

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ PASSED - Status: {response.status_code}")
                return True, response.json() if response.headers.get('content-type', '').startswith('application/json') else {}
            else:
                print(f"❌ FAILED - Expected {expected_status}, got {response.status_code}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ FAILED - Request timed out after {timeout} seconds")
            return False, {}
        except Exception as e:
            print(f"❌ FAILED - Error: {str(e)}")
            return False, {}

    def test_health(self):
        """Test health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "api/health",
            200
        )
        if success and response.get('status') == 'ok':
            print("✅ Health endpoint working correctly")
            return True
        print("❌ Health endpoint failed or returned unexpected response")
        return False

    def test_analyze_rca(self):
        """Test RCA analysis endpoint"""
        sample_rca = """Incident Summary
On January 15, 2026, the payment processing service experienced a complete outage lasting 47 minutes, affecting approximately 12,000 customers.

Timeline
- 14:02 UTC: Deployment of payment-service v2.4.1 initiated
- 14:08 UTC: Deployment completed successfully
- 14:15 UTC: First customer complaints received
- 14:49 UTC: Service fully restored

Root Cause
Database connection pool exhaustion due to query pattern change.

Action Items
1. Revert the problematic query pattern (Owner: Backend Team, Due: Jan 16)
2. Add connection pool monitoring (Owner: SRE Team, Due: Jan 20)"""

        success, response = self.run_test(
            "RCA Analysis",
            "POST",
            "api/analyze-rca",
            200,
            data={"document_text": sample_rca},
            timeout=45
        )
        
        if success:
            # Validate response structure
            required_fields = ['score', 'total_score', 'comments', 'executive_summary', 'timestamp']
            missing_fields = [field for field in required_fields if field not in response]
            
            if missing_fields:
                print(f"❌ Missing required fields in response: {missing_fields}")
                return False
                
            # Validate score structure
            score = response.get('score', {})
            expected_dimensions = [
                'incident_clarity', 'timeline_completeness', 'root_cause_depth',
                'detection_alerting', 'corrective_actions', 'learnings_quality'
            ]
            score_missing = [dim for dim in expected_dimensions if dim not in score]
            
            if score_missing:
                print(f"❌ Missing score dimensions: {score_missing}")
                return False
            
            # Validate total score range
            total_score = response.get('total_score', 0)
            if not (0 <= total_score <= 30):
                print(f"❌ Invalid total score: {total_score} (should be 0-30)")
                return False
                
            # Validate executive summary structure  
            es = response.get('executive_summary', {})
            es_required = ['overall_interpretation', 'leadership_bullets', 'key_gaps', 
                          'recurrence_risk', 'recurrence_rationale', 'action_critique', 'improvements']
            es_missing = [field for field in es_required if field not in es]
            
            if es_missing:
                print(f"❌ Missing executive summary fields: {es_missing}")
                return False
                
            print("✅ RCA Analysis endpoint working correctly with proper response structure")
            return True, response
        return False, {}

    def test_chat(self):
        """Test chat endpoint"""
        success, response = self.run_test(
            "Chat",
            "POST", 
            "api/chat",
            200,
            data={
                "message": "Summarize this RCA for leadership",
                "document_context": "Sample RCA document for testing",
                "session_id": self.session_id
            },
            timeout=30
        )
        
        if success:
            if 'reply' not in response or 'session_id' not in response:
                print("❌ Chat response missing required fields")
                return False
                
            self.session_id = response['session_id']
            print("✅ Chat endpoint working correctly")
            return True, response
        return False, {}

    def test_process_reply(self):
        """Test process reply endpoint"""
        success, response = self.run_test(
            "Process Reply",
            "POST",
            "api/process-reply", 
            200,
            data={
                "thread_context": "Discussion about timeline gaps",
                "user_reply": "I've added more detailed timestamps to the timeline section",
                "issue_type": "Timeline gap",
                "original_comment": "The timeline lacks specific timestamps for key events"
            },
            timeout=30
        )
        
        if success:
            if 'reply' not in response:
                print("❌ Process reply response missing reply field")
                return False
                
            print("✅ Process reply endpoint working correctly")
            return True
        return False

    def test_empty_document_validation(self):
        """Test validation with empty document"""
        success, response = self.run_test(
            "Empty Document Validation",
            "POST",
            "api/analyze-rca",
            400,
            data={"document_text": ""}
        )
        print("✅ Empty document validation working correctly" if success else "❌ Empty document validation failed")
        return success

    def test_empty_message_validation(self):
        """Test validation with empty chat message"""
        success, response = self.run_test(
            "Empty Message Validation", 
            "POST",
            "api/chat",
            400,
            data={"message": ""}
        )
        print("✅ Empty message validation working correctly" if success else "❌ Empty message validation failed")
        return success

    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*50}")
        print(f"📊 TEST SUMMARY")
        print(f"{'='*50}")
        print(f"Tests run: {self.tests_run}")
        print(f"Tests passed: {self.tests_passed}")
        print(f"Success rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 ALL TESTS PASSED!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} TESTS FAILED")
            return False

def main():
    print("🚀 Starting RCA Reviewer API Tests")
    print("=" * 50)
    
    tester = RCAReviewerAPITester()
    
    # Core functionality tests
    health_ok = tester.test_health()
    if not health_ok:
        print("❌ Health check failed - stopping tests")
        return 1
    
    analyze_ok, analysis_response = tester.test_analyze_rca()
    chat_ok, chat_response = tester.test_chat()
    reply_ok = tester.test_process_reply()
    
    # Validation tests
    empty_doc_ok = tester.test_empty_document_validation()
    empty_msg_ok = tester.test_empty_message_validation()
    
    # Print summary
    all_passed = tester.print_summary()
    
    # Additional checks
    if analyze_ok:
        print(f"\n📈 Analysis Details:")
        print(f"   Total Score: {analysis_response.get('total_score', 'N/A')}/30")
        print(f"   Comments: {len(analysis_response.get('comments', []))}")
        print(f"   Executive Summary Sections: {len(analysis_response.get('executive_summary', {}))}")
    
    if chat_ok:
        print(f"\n💬 Chat Details:")
        print(f"   Session ID: {chat_response.get('session_id', 'N/A')}")
        print(f"   Reply length: {len(chat_response.get('reply', ''))}")

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())