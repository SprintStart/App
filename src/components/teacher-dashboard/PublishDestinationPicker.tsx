import { useEffect, useState } from 'react';
import { Globe2, GraduationCap, School as SchoolIcon, Lock, CheckCircle, AlertCircle } from 'lucide-react';
import {
  matchTeacherToSchools,
  checkTeacherPremiumStatus,
  fetchAllSchools,
  type School
} from '../../lib/schoolDomainMatcher';
import { getAllCountries, getExamsForCountry, type StaticCountry } from '../../lib/staticCountryExamConfig';

export type PublishDestination =
  | { type: 'global'; school_id: null; exam_system_id: null; country_code: null; exam_code: null }
  | { type: 'country_exam'; school_id: null; exam_system_id: null; country_code: string; exam_code: string }
  | { type: 'school'; school_id: string; exam_system_id: null; country_code: null; exam_code: null };

interface Props {
  teacherEmail: string;
  teacherId: string;
  selectedDestination: PublishDestination | null;
  onSelect: (destination: PublishDestination) => void;
}

export function PublishDestinationPicker({ teacherEmail, teacherId, selectedDestination, onSelect }: Props) {
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [matchedSchools, setMatchedSchools] = useState<School[]>([]);
  const [autoSelectedSchool, setAutoSelectedSchool] = useState<School | null>(null);
  const [allSchools, setAllSchools] = useState<School[]>([]);
  const [countries] = useState<StaticCountry[]>(() => {
    const countryList = getAllCountries();
    console.log('[Destination Picker] Countries loaded:', countryList.length);
    return countryList;
  });
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('');
  const [selectedExamName, setSelectedExamName] = useState<string>('');
  const [availableExams, setAvailableExams] = useState<string[]>([]);

  useEffect(() => {
    async function initialize() {
      setLoading(true);

      try {
        // Check premium status
        const premium = await checkTeacherPremiumStatus(teacherId);
        setIsPremium(premium);

        // Match teacher to schools by email domain
        const { matchedSchools: matched, autoSelectedSchool: autoSelected } =
          await matchTeacherToSchools(teacherEmail);

        setMatchedSchools(matched);
        setAutoSelectedSchool(autoSelected);

        // If exactly one school matches, auto-select it
        if (autoSelected) {
          console.log('[Destination Picker] Auto-selecting school:', autoSelected.name);
          onSelect({
            type: 'school',
            school_id: autoSelected.id,
            exam_system_id: null,
            country_code: null,
            exam_code: null
          });
        }

        // If premium, fetch all schools for manual selection
        if (premium) {
          const schoolsList = await fetchAllSchools();
          setAllSchools(schoolsList);
        }
      } catch (error) {
        console.error('[Destination Picker] Initialization error:', error);
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, [teacherEmail, teacherId]);

  useEffect(() => {
    // Load exams when country is selected (static data, no fetch)
    if (selectedCountryCode) {
      const exams = getExamsForCountry(selectedCountryCode);
      console.log('[Destination Picker] Exams for', selectedCountryCode, ':', exams);
      setAvailableExams(exams);
    } else {
      setAvailableExams([]);
    }
  }, [selectedCountryCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const canPublishToSchool = isPremium || matchedSchools.length > 0;
  const availableSchools = isPremium ? allSchools : matchedSchools;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Where are you publishing this quiz?</h2>
        <p className="text-sm text-gray-600">Choose where students will access your quiz</p>
      </div>

      {/* Auto-selected school notification */}
      {autoSelectedSchool && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-green-900">School Detected</h4>
            <p className="text-sm text-green-700 mt-1">
              Your email domain matches <strong>{autoSelectedSchool.name}</strong>.
              Your quiz will be published to this school's wall by default.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {/* Option 1: Global StartSprint */}
        <button
          onClick={() => onSelect({
            type: 'global',
            school_id: null,
            exam_system_id: null,
            country_code: null,
            exam_code: null
          })}
          className={`
            p-6 border-2 rounded-lg text-left transition-all
            ${selectedDestination?.type === 'global'
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300 bg-white'
            }
          `}
        >
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg ${selectedDestination?.type === 'global' ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Globe2 className={`w-6 h-6 ${selectedDestination?.type === 'global' ? 'text-blue-600' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Global StartSprint Library</h3>
              <p className="text-sm text-gray-600">
                For non-curriculum content: aptitude tests, career prep, life skills, and general knowledge. Not for exam-specific content.
              </p>
              <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Public Access
              </span>
            </div>
            {selectedDestination?.type === 'global' && (
              <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0" />
            )}
          </div>
        </button>

        {/* Option 2: Country & Exam System */}
        <div
          className={`
            p-6 border-2 rounded-lg transition-all
            ${selectedDestination?.type === 'country_exam'
              ? 'border-purple-500 bg-purple-50'
              : 'border-gray-200 bg-white'
            }
          `}
        >
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-lg ${selectedDestination?.type === 'country_exam' ? 'bg-purple-100' : 'bg-gray-100'}`}>
              <GraduationCap className={`w-6 h-6 ${selectedDestination?.type === 'country_exam' ? 'text-purple-600' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-1">Country & Exam System</h3>
              <p className="text-sm text-gray-600">
                Publish to a specific country's exam system (GCSE, WASSCE, SAT, etc.)
              </p>
              <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                Region-Specific
              </span>
            </div>
            {selectedDestination?.type === 'country_exam' && (
              <CheckCircle className="w-6 h-6 text-purple-600 flex-shrink-0" />
            )}
          </div>

          {/* Country selector */}
          <div className="ml-16 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Country
              </label>
              <select
                value={selectedCountryCode}
                onChange={(e) => {
                  setSelectedCountryCode(e.target.value);
                  setSelectedExamName(''); // Reset exam when country changes
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Choose a country...</option>
                {countries.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.emoji} {country.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedCountryCode && availableExams.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Exam System
                </label>
                <select
                  value={selectedExamName}
                  onChange={(e) => {
                    const examName = e.target.value;
                    setSelectedExamName(examName);

                    if (examName) {
                      const country = countries.find(c => c.code === selectedCountryCode);

                      if (country) {
                        onSelect({
                          type: 'country_exam',
                          school_id: null,
                          exam_system_id: null,
                          country_code: selectedCountryCode,
                          exam_code: examName
                        });
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Choose an exam system...</option>
                  {availableExams.map(exam => (
                    <option key={exam} value={exam}>
                      {exam}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Option 3: School Wall */}
        <div
          className={`
            p-6 border-2 rounded-lg transition-all
            ${!canPublishToSchool ? 'opacity-50 cursor-not-allowed' : ''}
            ${selectedDestination?.type === 'school'
              ? 'border-green-500 bg-green-50'
              : 'border-gray-200 bg-white'
            }
          `}
        >
          <div className="flex items-start gap-4 mb-4">
            <div className={`p-3 rounded-lg ${selectedDestination?.type === 'school' ? 'bg-green-100' : 'bg-gray-100'}`}>
              <SchoolIcon className={`w-6 h-6 ${selectedDestination?.type === 'school' ? 'text-green-600' : 'text-gray-600'}`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-gray-900">School Wall</h3>
                {!canPublishToSchool && <Lock className="w-4 h-4 text-gray-400" />}
              </div>
              <p className="text-sm text-gray-600">
                Publish to a specific school's private quiz wall
              </p>
              {canPublishToSchool ? (
                <span className="inline-block mt-2 text-xs font-medium text-green-700 bg-green-100 px-2 py-1 rounded">
                  {isPremium ? 'Premium Access' : 'Domain Match'}
                </span>
              ) : (
                <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  Premium Required
                </span>
              )}
            </div>
            {selectedDestination?.type === 'school' && (
              <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />
            )}
          </div>

          {canPublishToSchool && availableSchools.length > 0 ? (
            <div className="ml-16">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select School
              </label>
              <select
                value={selectedDestination?.type === 'school' ? selectedDestination.school_id : ''}
                onChange={(e) => {
                  if (e.target.value) {
                    onSelect({
                      type: 'school',
                      school_id: e.target.value,
                      exam_system_id: null,
                      country_code: null,
                      exam_code: null
                    });
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Choose a school...</option>
                {availableSchools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </select>
            </div>
          ) : !canPublishToSchool && (
            <div className="ml-16 mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-gray-600">
                  <p className="font-medium">Premium access required</p>
                  <p className="mt-1">
                    Upgrade to premium or use a school email address to publish to school walls.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected destination summary */}
      {selectedDestination && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Selected Destination</h4>
          <p className="text-sm text-blue-700">
            {selectedDestination.type === 'global' && 'Global StartSprint Library - Public access'}
            {selectedDestination.type === 'country_exam' && (
              <>
                Country & Exam System: {countries.find(c => c.code === selectedCountryCode)?.name} - {selectedExamName}
              </>
            )}
            {selectedDestination.type === 'school' && (
              <>
                School Wall: {availableSchools.find(s => s.id === selectedDestination.school_id)?.name}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
